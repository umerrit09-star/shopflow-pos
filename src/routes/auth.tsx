import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { loginIdentifierToEmail } from "@/lib/username";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CloudCart POS" },
      { name: "description", content: "Sign in to your CloudCart shop with the username and password assigned by your administrator." },
      { property: "og:title", content: "Sign in — CloudCart POS" },
      { property: "og:description", content: "Access your CloudCart POS terminal, inventory and analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
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
      email: loginIdentifierToEmail(username),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid username or password");
      return;
    }
    void navigate({ to: "/pos", replace: true });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/pos", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-lift">
        <img src={logoAsset.url} alt="CloudCart" className="mx-auto h-14 w-auto object-contain" />

        <div className="mt-5 text-center">
          <h1 className="font-display text-lg font-bold">Shop sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the username and password assigned by your administrator.
          </p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={signIn}>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoCapitalize="none"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
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

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> admin <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={google}>
          Continue with Google
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need a shop account? Contact your CloudCart administrator.
        </p>
      </div>
    </div>
  );
}
