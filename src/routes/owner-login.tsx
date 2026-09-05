import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/owner-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shop Owner Sign In — CloudCart POS" },
      {
        name: "description",
        content:
          "Shop owners sign in with the username and password assigned by the CloudCart administrator.",
      },
      { property: "og:title", content: "Shop Owner Sign In — CloudCart POS" },
      {
        property: "og:description",
        content: "Access your CloudCart shop dashboard and POS terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerLoginPage,
});

function OwnerLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/pos", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid username or password");
      return;
    }
    void navigate({ to: "/pos", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-lift">
        <img src={logoAsset.url} alt="CloudCart" className="mx-auto h-14 w-auto object-contain" />

        <div className="mt-5 text-center">
          <h1 className="font-display text-lg font-bold">Shop Owner sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the shop username and password assigned by your CloudCart administrator.
          </p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={signIn}>
          <div className="space-y-1.5">
            <Label htmlFor="owner-username">Shop Username</Label>
            <Input
              id="owner-username"
              autoCapitalize="none"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-password">Password</Label>
            <Input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Cashier? Use the main sign in page. Need a shop account? Contact your CloudCart
          administrator.
        </p>
      </div>
    </div>
  );
}
