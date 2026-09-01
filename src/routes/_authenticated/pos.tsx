import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Minus, Plus, Printer, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useSignedUrl } from "@/lib/session";
import { useProducts, type Product } from "@/lib/data";
import { recognizeProduct } from "@/lib/pos.functions";
import { pkr, dateTime } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS Terminal — CloudCart" },
      { name: "description", content: "Mobile checkout terminal with AI product camera and PKR receipts." },
      { property: "og:title", content: "POS Terminal — CloudCart" },
      { property: "og:description", content: "Fast touch checkout, AI scanning and thermal receipts in Rs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PosPage,
});

type CartLine = { product: Product; quantity: number };

type Receipt = {
  receiptNo: number;
  createdAt: string;
  lines: { title: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cashReceived: number;
  changeDue: number;
};

function PosPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProducts(me?.shopId);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState("0");
  const [taxPct, setTaxPct] = useState("0");
  const [cash, setCash] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const cameraRef = useRef<HTMLInputElement>(null);
  const shopLogo = useSignedUrl(me?.shop?.logo_url);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const subtotal = cart.reduce((sum, l) => sum + Number(l.product.selling_price) * l.quantity, 0);
  const discount = (subtotal * Math.max(0, Number(discountPct) || 0)) / 100;
  const tax = ((subtotal - discount) * Math.max(0, Number(taxPct) || 0)) / 100;
  const total = Math.max(0, subtotal - discount + tax);
  const cashReceived = Number(cash) || 0;
  const changeDue = cashReceived > 0 ? cashReceived - total : 0;
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Only ${product.stock_quantity} left in stock`);
          return current;
        }
        return current.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (product.stock_quantity < 1) {
        toast.error("Out of stock");
        return current;
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((l) => (l.product.id === productId ? { ...l, quantity: Math.min(quantity, l.product.stock_quantity) } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  async function onCameraPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the photo"));
        reader.readAsDataURL(file);
      });
      const result = await recognizeProduct({ data: { imageDataUrl: dataUrl } });
      const match = products.find((p) => p.id === result.productId);
      if (!match) {
        toast.error(result.reason ?? "Product not recognised");
        return;
      }
      addToCart(match);
      toast.success(`Added ${match.title}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recognition failed");
    } finally {
      setScanning(false);
    }
  }

  async function checkout() {
    if (!me?.shopId || cart.length === 0) return;
    if (cashReceived < total) {
      toast.error("Cash received is less than the total");
      return;
    }
    setSaving(true);
    try {
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          shop_id: me.shopId,
          cashier_id: me.userId,
          subtotal,
          discount,
          tax,
          total,
          cash_received: cashReceived,
          change_due: changeDue,
        })
        .select("id, receipt_no, created_at")
        .single();
      if (error) throw error;

      const items = cart.map((l) => ({
        sale_id: sale.id,
        shop_id: me.shopId!,
        product_id: l.product.id,
        title: l.product.title,
        quantity: l.quantity,
        unit_price: Number(l.product.selling_price),
        line_total: Number(l.product.selling_price) * l.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      await Promise.all(
        cart.map((l) =>
          supabase
            .from("products")
            .update({ stock_quantity: Math.max(0, l.product.stock_quantity - l.quantity) })
            .eq("id", l.product.id),
        ),
      );

      setReceipt({
        receiptNo: sale.receipt_no,
        createdAt: sale.created_at,
        lines: items.map((i) => ({
          title: i.title,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          lineTotal: i.line_total,
        })),
        subtotal,
        discount,
        tax,
        total,
        cashReceived,
        changeDue,
      });
      setCart([]);
      setCash("");
      setDiscountPct("0");
      setTaxPct("0");
      void queryClient.invalidateQueries();
      toast.success("Sale completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setSaving(false);
    }
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {cart.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Cart is empty</p>}
        {cart.map((line) => (
          <div key={line.product.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
            <ProductImage path={line.product.image_url} title={line.product.title} className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{line.product.title}</p>
              <p className="text-xs text-muted-foreground">{pkr(line.product.selling_price)} each</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => setQuantity(line.product.id, line.quantity - 1)}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-7 text-center text-sm font-bold">{line.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => setQuantity(line.product.id, line.quantity + 1)}
              >
                <Plus className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-destructive"
                onClick={() => setQuantity(line.product.id, 0)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="discount" className="text-xs">
              Discount %
            </Label>
            <Input
              id="discount"
              inputMode="decimal"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax" className="text-xs">
              Tax %
            </Label>
            <Input id="tax" inputMode="decimal" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={pkr(subtotal)} />
          {discount > 0 && <Row label="Discount" value={`- ${pkr(discount)}`} />}
          {tax > 0 && <Row label="Tax" value={pkr(tax)} />}
          <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-extrabold">
            <span>Total</span>
            <span>{pkr(total)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cash" className="text-xs">
            Cash received
          </Label>
          <Input
            id="cash"
            inputMode="decimal"
            placeholder="0.00"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm font-bold">
          <span>Change</span>
          <span>{pkr(Math.max(0, changeDue))}</span>
        </div>

        <Button className="h-12 w-full text-base" disabled={saving || cart.length === 0} onClick={checkout}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : `Charge ${pkr(total)}`}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Search name, SKU or barcode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="h-11 shrink-0 bg-gradient-accent text-accent-foreground"
            disabled={scanning}
            onClick={() => cameraRef.current?.click()}
          >
            {scanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            <span className="ml-1 hidden sm:inline">AI scan</span>
          </Button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onCameraPick}
          />
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No products yet — add them in the Inventory tab.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="rounded-2xl border border-border bg-card p-2 text-left shadow-soft transition-transform active:scale-[0.97]"
              >
                <ProductImage path={product.image_url} title={product.title} className="aspect-square w-full" />
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{product.title}</p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-primary">{pkr(product.selling_price)}</span>
                  <Badge
                    variant={product.stock_quantity > 5 ? "secondary" : "destructive"}
                    className="shrink-0 text-[10px]"
                  >
                    {product.stock_quantity} left
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop cart */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <ShoppingCart className="size-4" /> Cart
          </h2>
          {cartPanel}
        </div>
      </aside>

      {/* Mobile floating cart bar */}
      <div className="fixed inset-x-0 bottom-[4.25rem] z-30 px-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex w-full items-center justify-between rounded-2xl bg-gradient-brand px-4 py-3 text-primary-foreground shadow-lift">
              <span className="flex items-center gap-2 text-sm font-bold">
                <ShoppingCart className="size-4" /> {cartCount} item{cartCount === 1 ? "" : "s"}
              </span>
              <span className="text-base font-extrabold">{pkr(total)}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Current sale</SheetTitle>
            </SheetHeader>
            <div className="mt-3 h-[calc(85vh-6rem)] px-1">{cartPanel}</div>
          </SheetContent>
        </Sheet>
      </div>

      {receipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lift">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Sale complete</h2>
                <p className="text-sm text-muted-foreground">Receipt #{receipt.receiptNo}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setReceipt(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Total" value={pkr(receipt.total)} />
              <Row label="Cash received" value={pkr(receipt.cashReceived)} />
              <Row label="Change" value={pkr(Math.max(0, receipt.changeDue))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPaperWidth(paperWidth === "80mm" ? "58mm" : "80mm")}
              >
                {paperWidth}
              </Button>
              <Button className="flex-1" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="receipt-print" style={{ ["--receipt-width" as string]: paperWidth }}>
          {shopLogo && <img src={shopLogo} alt="" style={{ maxWidth: "40mm", margin: "0 auto 2mm", display: "block" }} />}
          <div style={{ textAlign: "center", marginBottom: "2mm" }}>
            <div style={{ fontSize: "14px", fontWeight: 700 }}>{me?.shop?.name}</div>
            {me?.shop?.address && <div>{me.shop.address}</div>}
            {me?.shop?.phone && <div>Tel: {me.shop.phone}</div>}
          </div>
          <div>Receipt #: {receipt.receiptNo}</div>
          <div>{dateTime(receipt.createdAt)}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />
          {receipt.lines.map((line, index) => (
            <div key={index} style={{ display: "flex", justifyContent: "space-between", gap: "2mm" }}>
              <span>
                {line.quantity} x {line.title}
              </span>
              <span>{pkr(line.lineTotal)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />
          <PrintRow label="Subtotal" value={pkr(receipt.subtotal)} />
          {receipt.discount > 0 && <PrintRow label="Discount" value={`- ${pkr(receipt.discount)}`} />}
          {receipt.tax > 0 && <PrintRow label="Tax" value={pkr(receipt.tax)} />}
          <PrintRow label="TOTAL" value={pkr(receipt.total)} bold />
          <PrintRow label="Cash received" value={pkr(receipt.cashReceived)} />
          <PrintRow label="Change" value={pkr(Math.max(0, receipt.changeDue))} />
          <div style={{ borderTop: "1px dashed #000", margin: "1.5mm 0" }} />
          <div style={{ textAlign: "center" }}>Thank you for shopping!</div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function PrintRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
