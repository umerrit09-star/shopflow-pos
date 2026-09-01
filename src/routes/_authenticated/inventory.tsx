import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/session";
import { useProducts, type Product } from "@/lib/data";
import { pkr } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — CloudCart" },
      { name: "description", content: "Manage products, SKUs, cost and selling prices in PKR, and stock levels." },
      { property: "og:title", content: "Inventory — CloudCart" },
      { property: "og:description", content: "Add, edit and track every product with low-stock alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

type Draft = {
  id?: string;
  title: string;
  sku: string;
  category: string;
  cost_price: string;
  selling_price: string;
  stock_quantity: string;
  image_url: string | null;
};

const emptyDraft: Draft = {
  title: "",
  sku: "",
  category: "",
  cost_price: "",
  selling_price: "",
  stock_quantity: "0",
  image_url: null,
};

function InventoryPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProducts(me?.shopId);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const lowStock = products.filter((p) => p.stock_quantity <= 5);

  function openEdit(product: Product) {
    setDraft({
      id: product.id,
      title: product.title,
      sku: product.sku ?? "",
      category: product.category ?? "",
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      stock_quantity: String(product.stock_quantity),
      image_url: product.image_url,
    });
  }

  async function uploadImage(file: File) {
    if (!me?.shopId) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${me.shopId}/products/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("shop-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft((d) => (d ? { ...d, image_url: path } : d));
    toast.success("Image uploaded");
  }

  async function save() {
    if (!draft || !me?.shopId) return;
    if (!draft.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const payload = {
      shop_id: me.shopId,
      title: draft.title.trim(),
      sku: draft.sku.trim() || null,
      category: draft.category.trim() || null,
      cost_price: Number(draft.cost_price) || 0,
      selling_price: Number(draft.selling_price) || 0,
      stock_quantity: Number(draft.stock_quantity) || 0,
      image_url: draft.image_url,
    };
    const { error } = draft.id
      ? await supabase.from("products").update(payload).eq("id", draft.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDraft(null);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success("Product saved");
  }

  async function remove(product: Product) {
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) return toast.error(error.message);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success("Product deleted");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Search inventory"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={!!draft} onOpenChange={(open) => setDraft(open ? (draft ?? emptyDraft) : null)}>
          <DialogTrigger asChild>
            <Button className="h-11 shrink-0" onClick={() => setDraft(emptyDraft)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">Add item</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Edit product" : "New product"}</DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="space-y-3">
                <Field label="Title">
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SKU / Barcode">
                    <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
                  </Field>
                  <Field label="Category">
                    <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                  </Field>
                  <Field label="Cost price (Rs.)">
                    <Input
                      inputMode="decimal"
                      value={draft.cost_price}
                      onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
                    />
                  </Field>
                  <Field label="Selling price (Rs.)">
                    <Input
                      inputMode="decimal"
                      value={draft.selling_price}
                      onChange={(e) => setDraft({ ...draft, selling_price: e.target.value })}
                    />
                  </Field>
                  <Field label="Stock quantity">
                    <Input
                      inputMode="numeric"
                      value={draft.stock_quantity}
                      onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
                    />
                  </Field>
                  <Field label="Product image">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file);
                      }}
                    />
                  </Field>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save product"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            <span className="font-bold">{lowStock.length} item(s)</span> low on stock:{" "}
            {lowStock
              .slice(0, 4)
              .map((p) => p.title)
              .join(", ")}
            {lowStock.length > 4 ? "…" : ""}
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading inventory…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No products yet. Add your first item.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <ProductImage path={product.image_url} title={product.title} className="size-14 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{product.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {product.sku ? `${product.sku} · ` : ""}
                  {product.category ?? "Uncategorised"}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-bold text-primary">{pkr(product.selling_price)}</span>{" "}
                  <span className="text-xs text-muted-foreground">cost {pkr(product.cost_price)}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={product.stock_quantity > 5 ? "secondary" : "destructive"}>
                  {product.stock_quantity} in stock
                </Badge>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(product)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => void remove(product)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
