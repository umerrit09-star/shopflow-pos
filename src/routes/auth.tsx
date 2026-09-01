import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CloudCart POS" },
      { name: "description", content: "Sign in to your CloudCart shop or register a new store account." },
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/pos", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    void navigate({ to: "/pos", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { shop_name: shopName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      setSent(true);
      return;
    }
    void navigate({ to: "/pos", replace: true });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Google sign-in failed");
    if (result.redirected) return;
    void navigate({ to: "/pos", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-lift">
        <img src={logoAsset.url} alt="CloudCart" className="mx-auto h-14 w-auto object-contain" />

        {sent ? (
          <div className="mt-6 text-center">
            <h1 className="text-lg font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to {email}. Confirm it, then sign in to open your shop.
            </p>
            <Button className="mt-5 w-full" variant="outline" onClick={() => setSent(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">New shop</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-3" onSubmit={signIn}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-3" onSubmit={signUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="shop">Shop name</Label>
                  <Input id="shop" required value={shopName} onChange={(e) => setShopName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create shop account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {!sent && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              Continue with Google
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
