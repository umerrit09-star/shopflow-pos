import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/super-admin-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Super Admin Sign In — CloudCart POS" },
      {
        name: "description",
        content:
          "Platform sign in for CloudCart super admins and administrators using a username and password.",
      },
      { property: "og:title", content: "Super Admin Sign In — CloudCart POS" },
      {
        property: "og:description",
        content: "Manage shops, subscriptions and administrator logins from the CloudCart control panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuperAdminLoginPage,
});

function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const identifier = username.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.includes("@") ? identifier.toLowerCase() : usernameToEmail(identifier),
      password,
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Invalid username or password");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "super_admin" || r.role === "admin");
    setBusy(false);

    if (!allowed) {
      await supabase.auth.signOut();
      toast.error("This login is not an administrator account");
      return;
    }

    void navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-lift">
        <img src={logoAsset.url} alt="CloudCart" className="mx-auto h-14 w-auto object-contain" />

        <div className="mt-5 text-center">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-secondary">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <h1 className="font-display text-lg font-bold">Administrator sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Username and password only. Shop and till logins use their own sign-in pages.
          </p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={signIn}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="e.g. superadmin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
