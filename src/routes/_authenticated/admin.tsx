import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pause, Play, Plus, ShieldAlert, Store, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/session";
import { createShopAccount, deleteShopAccount } from "@/lib/pos.functions";
import { pkr, dateTime } from "@/lib/format";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — CloudCart Shops" },
      {
        name: "description",
        content: "Manage every CloudCart tenant: create shops, hold unpaid subscriptions and track sales volume.",
      },
      { property: "og:title", content: "Super Admin — CloudCart Shops" },
      {
        property: "og:description",
        content: "Platform control panel for shop accounts, subscription holds and system-wide sales in Rs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type ShopRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: "active" | "held";
  created_at: string;
};

function AdminPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const isSuperAdmin = me?.roles.includes("super_admin") ?? false;

  const shopsQuery = useQuery({
    queryKey: ["admin-shops"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, address, phone, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShopRow[];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["admin-sales"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("shop_id, total").limit(20000);
      if (error) throw error;
      return (data ?? []) as { shop_id: string; total: number }[];
    },
  });

  const staffQuery = useQuery({
    queryKey: ["admin-staff"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, shop_id, full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; shop_id: string | null; full_name: string | null }[];
    },
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShopRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ shopName: "", ownerName: "", username: "", password: "" });

  const perShop = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number }>();
    for (const sale of salesQuery.data ?? []) {
      const entry = map.get(sale.shop_id) ?? { revenue: 0, orders: 0 };
      entry.revenue += Number(sale.total);
      entry.orders += 1;
      map.set(sale.shop_id, entry);
    }
    return map;
  }, [salesQuery.data]);

  const staffCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const person of staffQuery.data ?? []) {
      if (!person.shop_id) continue;
      map.set(person.shop_id, (map.get(person.shop_id) ?? 0) + 1);
    }
    return map;
  }, [staffQuery.data]);

  const shops = shopsQuery.data ?? [];
  const activeShops = shops.filter((s) => s.status === "active").length;
  const totalVolume = (salesQuery.data ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const totalOrders = (salesQuery.data ?? []).length;

  async function setStatus(shop: ShopRow, status: "active" | "held") {
    setBusyId(shop.id);
    try {
      const { error } = await supabase.from("shops").update({ status }).eq("id", shop.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
      toast.success(status === "held" ? `${shop.name} put on hold` : `${shop.name} reactivated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the shop");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const shop = pendingDelete;
    if (!shop) return;
    setBusyId(shop.id);
    try {
      await deleteShopAccount({ data: { shopId: shop.id } });
      await queryClient.invalidateQueries();
      toast.success(`${shop.name} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the shop");
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  async function createShop() {
    if (!form.shopName.trim() || form.username.trim().length < 3 || form.password.length < 6) {
      toast.error("Shop name, a 3+ character username and a 6+ character password are required");
      return;
    }
    setCreating(true);
    try {
      await createShopAccount({
        data: {
          shopName: form.shopName.trim(),
          username: form.username.trim(),
          password: form.password,
          ownerName: form.ownerName.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Shop account created");
      setForm({ shopName: "", ownerName: "", username: "", password: "" });
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the shop");
    } finally {
      setCreating(false);
    }
  }

  if (meLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading admin panel…</p>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <ShieldAlert className="mx-auto size-8 text-destructive" />
        <h1 className="mt-3 text-xl font-bold">Restricted area</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only CloudCart platform super admins can manage shop accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Shop accounts</h1>
          <p className="text-sm text-muted-foreground">Manage every tenant on the platform.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand text-primary-foreground">
              <Plus className="size-4" /> New shop
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create shop account</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="shopName">Shop name</Label>
                <Input
                  id="shopName"
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ownerName">Owner name</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Owner email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Temporary password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={creating} onClick={createShop}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : "Create shop"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Store className="size-4" />} label="Active shops" value={`${activeShops} / ${shops.length}`} />
        <Stat icon={<Pause className="size-4" />} label="On hold" value={String(shops.length - activeShops)} />
        <Stat icon={<Wallet className="size-4" />} label="System sales volume" value={pkr(totalVolume)} />
        <Stat icon={<Wallet className="size-4" />} label="Transactions" value={String(totalOrders)} />
      </div>

      {shopsQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading shops…</p>
      ) : shopsQuery.isError ? (
        <p className="py-12 text-center text-sm text-destructive">Could not load shops. Please retry.</p>
      ) : shops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <p className="text-sm font-semibold">No shops registered yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first tenant with the “New shop” button.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const stats = perShop.get(shop.id) ?? { revenue: 0, orders: 0 };
            const busy = busyId === shop.id;
            return (
              <div key={shop.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{shop.name}</p>
                      <Badge variant={shop.status === "active" ? "secondary" : "destructive"}>
                        {shop.status === "active" ? "Active" : "Held"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shop.address || "No address"} · {shop.phone || "No phone"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {dateTime(shop.created_at)} · {staffCount.get(shop.id) ?? 0} staff
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{pkr(stats.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{stats.orders} sales</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {shop.status === "active" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(shop, "held")}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />} Hold
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => setStatus(shop, "active")}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Resume
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => setPendingDelete(shop)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the shop, its inventory, sales history and all staff logins. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete shop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
    </div>
  );
}
