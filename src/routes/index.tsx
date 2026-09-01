import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Boxes, Camera, Printer, ScanLine, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/cloudcart-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloudCart — Cloud POS & Inventory for Pakistani Retail" },
      {
        name: "description",
        content:
          "CloudCart is a mobile-first cloud POS and inventory system for Pakistani shops: AI product scanning, PKR receipts, thermal printing and live sales analytics.",
      },
      { property: "og:title", content: "CloudCart — Cloud POS & Inventory in PKR" },
      {
        property: "og:description",
        content:
          "Run your counter from a phone: AI camera checkout, inventory in Rs., thermal receipts and per-shop analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ScanLine, title: "Touch POS terminal", body: "One-hand checkout with a floating cart bar built for phones." },
  { icon: Camera, title: "AI product camera", body: "Snap an item and CloudCart matches it to your catalog instantly." },
  { icon: Printer, title: "80mm thermal receipts", body: "Branded receipts in Rs. printed straight from the browser." },
  { icon: Boxes, title: "Live inventory", body: "SKU, barcode, cost, price and stock alerts for every product." },
  { icon: BarChart3, title: "Sales analytics", body: "Daily and weekly PKR trends plus top-selling products." },
  { icon: ShieldCheck, title: "Multi-shop ready", body: "Each shop's data stays fully isolated from every other tenant." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <img src={logoAsset.url} alt="CloudCart logo" className="h-10 w-auto object-contain" />
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-6">
        <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">
          Cloud POS · Pakistan
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
          Your whole counter, running from a phone.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          CloudCart is a cloud point-of-sale and inventory system for Pakistani retail. Every rupee, receipt
          and stock count in one mobile-first workspace.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground shadow-lift">
            <Link to="/auth">Start your shop</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Open POS terminal</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-accent text-accent-foreground">
              <f.icon className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        CloudCart · Mobile POS &amp; Inventory · Prices in Pakistani Rupees
      </footer>
    </div>
  );
}
