import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/session";
import {
  createCashierAccount,
  deleteCashierAccount,
  setCashierActive,
  updateCashierCredentials,
} from "@/lib/pos.functions";
import { dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/cashiers")({
  head: () => ({
    meta: [
      { title: "Cashiers — CloudCart" },
      {
        name: "description",
        content: "Create and manage cashier logins for your CloudCart shop with username, password and active status.",
      },
      { property: "og:title", content: "Cashiers — CloudCart" },
      {
        property: "og:description",
        content: "Owner tools to add cashiers, reset passwords and switch till access on or off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashiersPage,
});

type CashierRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  active: boolean;
  created_at: string;
};

function CashiersPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const isOwner = me?.roles.includes("owner") ?? false;

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [resetFor, setResetFor] = useState<CashierRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteFor, setDeleteFor] = useState<CashierRow | null>(null);

  const cashiersQuery = useQuery({
    queryKey: ["cashiers", me?.shopId],
    enabled: isOwner && !!me?.shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, active, created_at")
        .eq("shop_id", me!.shopId!)
        .neq("id", me!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CashierRow[];
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["cashiers"] });
  }

  async function addCashier() {
    if (!fullName.trim() || username.trim().length < 3 || password.length < 6) {
      toast.error("Enter a name, a username (3+ characters) and a password (6+ characters)");
      return;
    }
    setBusy(true);
    try {
      await createCashierAccount({
        data: { fullName: fullName.trim(), username: username.trim(), password },
      });
      toast.success("Cashier created");
      setAddOpen(false);
      setFullName("");
      setUsername("");
      setPassword("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create cashier");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CashierRow, active: boolean) {
    try {
      await setCashierActive({ data: { cashierId: row.id, active } });
      toast.success(active ? "Cashier activated" : "Cashier deactivated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cashier");
    }
  }

  async function resetPassword() {
    if (!resetFor || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await updateCashierCredentials({ data: { cashierId: resetFor.id, password: newPassword } });
      toast.success("Password updated");
      setResetFor(null);
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  async function removeCashier() {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await deleteCashierAccount({ data: { cashierId: deleteFor.id } });
      toast.success("Cashier removed");
      setDeleteFor(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove cashier");
    } finally {
      setBusy(false);
    }
  }

  if (meLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading cashiers…
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 size-8 text-destructive" />
        <h1 className="font-display text-lg font-bold">Owner access only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the shop owner can manage cashier accounts.
        </p>
      </div>
    );
  }

  const cashiers = cashiersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold">Cashiers</h1>
          <p className="text-sm text-muted-foreground">
            Give your staff their own till login. Cashiers can only sell — no reports or settings.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> Add cashier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New cashier</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cashier-name">Cashier name</Label>
                <Input
                  id="cashier-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ali Raza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashier-username">Username</Label>
                <Input
                  id="cashier-username"
                  value={username}
                  autoCapitalize="none"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ali.till1"
                />
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, dot, dash and underscore. No email needed.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashier-password">Password</Label>
                <Input
                  id="cashier-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={busy} onClick={addCashier}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create cashier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {cashiersQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : cashiersQuery.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          Could not load cashiers. Please try again.
        </div>
      ) : cashiers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <UserRound className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-semibold">No cashiers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first cashier to let staff run the till without seeing your business numbers.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cashiers.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{row.full_name ?? "Cashier"}</p>
                  <Badge variant={row.active ? "default" : "secondary"}>
                    {row.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {row.username ? `@${row.username}` : "—"} · added {dateTime(row.created_at)}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2 sm:mt-0">
                <Switch
                  checked={row.active}
                  aria-label="Active"
                  onCheckedChange={(value) => void toggleActive(row, value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResetFor(row);
                    setNewPassword("");
                  }}
                >
                  <KeyRound className="mr-2 size-4" /> Password
                </Button>
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setDeleteFor(row)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!resetFor} onOpenChange={(open) => !open && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {resetFor?.full_name ?? "cashier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={resetPassword}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteFor?.full_name ?? "this cashier"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their login stops working immediately. Past sales stay in your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeCashier()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
