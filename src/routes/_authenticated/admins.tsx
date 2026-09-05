import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, Pencil, Plus, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { useMe } from "@/lib/session";
import {
  createAdminAccount,
  deleteAdminAccount,
  listAdminAccounts,
  setAdminActive,
  updateAdminAccount,
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

export const Route = createFileRoute("/_authenticated/admins")({
  head: () => ({
    meta: [
      { title: "Admin Management — CloudCart Super Admin" },
      {
        name: "description",
        content:
          "Create, edit, activate and remove CloudCart administrator logins from the super admin control panel.",
      },
      { property: "og:title", content: "Admin Management — CloudCart Super Admin" },
      {
        property: "og:description",
        content: "Super admin controls for administrator accounts, passwords and access status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminsPage,
});

type AdminRow = {
  id: string;
  fullName: string | null;
  username: string | null;
  active: boolean;
  createdAt: string;
};

function AdminsPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const isSuperAdmin = me?.roles.includes("super_admin") ?? false;

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [editFor, setEditFor] = useState<AdminRow | null>(null);
  const [editName, setEditName] = useState("");
  const [resetFor, setResetFor] = useState<AdminRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteFor, setDeleteFor] = useState<AdminRow | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["admin-accounts"],
    enabled: isSuperAdmin,
    queryFn: async () => (await listAdminAccounts()) as AdminRow[],
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });

  const create = useMutation({
    mutationFn: () =>
      createAdminAccount({
        data: { fullName: fullName.trim(), username: username.trim(), password },
      }),
    onSuccess: async () => {
      toast.success("Administrator created");
      setAddOpen(false);
      setFullName("");
      setUsername("");
      setPassword("");
      await refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not create administrator"),
  });

  const rename = useMutation({
    mutationFn: (row: AdminRow) =>
      updateAdminAccount({ data: { adminId: row.id, fullName: editName.trim() } }),
    onSuccess: async () => {
      toast.success("Administrator updated");
      setEditFor(null);
      await refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update administrator"),
  });

  const resetPassword = useMutation({
    mutationFn: (row: AdminRow) =>
      updateAdminAccount({ data: { adminId: row.id, password: newPassword } }),
    onSuccess: () => {
      toast.success("Password updated");
      setResetFor(null);
      setNewPassword("");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update password"),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { row: AdminRow; active: boolean }) =>
      setAdminActive({ data: { adminId: vars.row.id, active: vars.active } }),
    onSuccess: async (_data, vars) => {
      toast.success(vars.active ? "Administrator activated" : "Administrator deactivated");
      await refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update status"),
  });

  const remove = useMutation({
    mutationFn: (row: AdminRow) => deleteAdminAccount({ data: { adminId: row.id } }),
    onSuccess: async () => {
      toast.success("Administrator deleted");
      setDeleteFor(null);
      await refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not delete administrator"),
  });

  if (meLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading administrators…
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 size-8 text-destructive" />
        <h1 className="font-display text-lg font-bold">Super admin access only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the platform super admin can manage administrator accounts.
        </p>
      </div>
    );
  }

  const admins = adminsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold">Admin management</h1>
          <p className="text-sm text-muted-foreground">
            Administrators help you manage shops. They never get super admin controls.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 size-4" /> Add admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New administrator</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Name</Label>
                <Input id="admin-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-user">Username</Label>
                <Input
                  id="admin-user"
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Password</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={
                  create.isPending ||
                  !fullName.trim() ||
                  username.trim().length < 3 ||
                  password.length < 6
                }
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Creating…" : "Create admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {adminsQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading administrators…
        </div>
      ) : adminsQuery.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-center text-sm text-destructive">
          Could not load administrators. Please try again.
        </div>
      ) : admins.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <UserCog className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-semibold">No administrators yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an administrator to help manage shop accounts.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {admins.map((row) => (
            <li key={row.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.fullName ?? "Administrator"}</p>
                  <p className="truncate text-xs text-muted-foreground">@{row.username ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Added {dateTime(row.createdAt)}</p>
                </div>
                <Badge variant={row.active ? "default" : "secondary"}>
                  {row.active ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                  <Switch
                    checked={row.active}
                    onCheckedChange={(active) => toggleActive.mutate({ row, active })}
                    aria-label="Toggle administrator access"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">Access</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditFor(row);
                    setEditName(row.fullName ?? "");
                  }}
                >
                  <Pencil className="mr-1.5 size-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setResetFor(row)}>
                  <KeyRound className="mr-1.5 size-3.5" /> Reset password
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteFor(row)}>
                  <Trash2 className="mr-1.5 size-3.5 text-destructive" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editFor} onOpenChange={(open) => !open && setEditFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit administrator</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Usernames are permanent. Delete and recreate the login to change it.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={rename.isPending || !editName.trim()}
              onClick={() => editFor && rename.mutate(editFor)}
            >
              {rename.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetFor}
        onOpenChange={(open) => {
          if (!open) {
            setResetFor(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reset-pass">New password</Label>
            <Input
              id="reset-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={resetPassword.isPending || newPassword.length < 6}
              onClick={() => resetFor && resetPassword.mutate(resetFor)}
            >
              {resetPassword.isPending ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this administrator?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFor?.fullName ?? "This administrator"} will lose access immediately. Shops and
              their data are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFor && remove.mutate(deleteFor)}
              disabled={remove.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
