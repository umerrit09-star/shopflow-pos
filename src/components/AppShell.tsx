import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, LogOut, Settings, ShieldCheck, ScanLine } from "lucide-react";
import { useMe, useSignedUrl, useSignOut } from "@/lib/session";
import { bootstrapAccount } from "@/lib/pos.functions";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const tabs = [
  { to: "/pos", label: "POS", icon: ScanLine },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isLoading, refetch } = useMe();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const bootstrapped = useRef(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logoUrl = useSignedUrl(me?.shop?.logo_url);

  useEffect(() => {
    if (isLoading || !me || bootstrapped.current) return;
    if (me.roles.length > 0) return;
    bootstrapped.current = true;
    bootstrapAccount({ data: {} })
      .then(() => {
        queryClient.invalidateQueries();
        void refetch();
      })
      .catch(() => {
        bootstrapped.current = false;
      });
  }, [isLoading, me, queryClient, refetch]);

  const isSuperAdmin = me?.roles.includes("super_admin") ?? false;
  const navItems = isSuperAdmin ? [{ to: "/admin", label: "Shops", icon: ShieldCheck }, ...tabs] : tabs;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your shop…
      </div>
    );
  }

  if (me && me.roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Setting up your shop workspace…
      </div>
    );
  }

  if (me?.shop && me.shop.status === "held" && !isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Subscription on hold</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {me.shop.name}&apos;s subscription is currently suspended. Contact CloudCart support to resume
          selling.
        </p>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
              {logoUrl ? (
                <img src={logoUrl} alt="Shop logo" className="size-full object-cover" />
              ) : (
                <img src={logoAsset.url} alt="CloudCart" className="size-full object-contain" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold leading-tight">
                {me?.shop?.name ?? "CloudCart Admin"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {isSuperAdmin ? "Super admin" : me?.email}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((tab) => (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    pathname === tab.to && "bg-secondary text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur sm:hidden">
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-muted-foreground transition-colors",
                  active && "bg-secondary text-primary",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
