import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useMe } from "@/lib/session";
import { useProducts, useSales, useSoldItems } from "@/lib/data";
import { dateTime, pkr, pkrCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Sales Analytics — CloudCart" },
      { name: "description", content: "Daily and weekly sales in PKR, top products, low stock alerts and history." },
      { property: "og:title", content: "Sales Analytics — CloudCart" },
      { property: "og:description", content: "Track rupee sales trends, best sellers and transaction history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function AnalyticsPage() {
  const { data: me } = useMe();
  const { data: sales = [] } = useSales(me?.shopId, 500);
  const { data: items = [] } = useSoldItems(me?.shopId);
  const { data: products = [] } = useProducts(me?.shopId);

  const daily = useMemo(() => {
    const days: { day: string; label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        day: dayKey(d),
        label: d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
        total: 0,
      });
    }
    const index = new Map(days.map((d) => [d.day, d]));
    for (const sale of sales) {
      const entry = index.get(sale.created_at.slice(0, 10));
      if (entry) entry.total += Number(sale.total);
    }
    return days;
  }, [sales]);

  const weekly = useMemo(() => {
    const buckets: { label: string; total: number }[] = [];
    for (let w = 5; w >= 0; w -= 1) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const total = sales
        .filter((s) => {
          const d = new Date(s.created_at);
          return d >= start && d <= end;
        })
        .reduce((sum, s) => sum + Number(s.total), 0);
      buckets.push({
        label: `${start.toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}`,
        total,
      });
    }
    return buckets;
  }, [sales]);

  const todayTotal = daily.at(-1)?.total ?? 0;
  const allTime = sales.reduce((sum, s) => sum + Number(s.total), 0);

  const topProducts = useMemo(() => {
    const map = new Map<string, { title: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const current = map.get(item.title) ?? { title: item.title, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.line_total;
      map.set(item.title, current);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [items]);

  const lowStock = products.filter((p) => p.stock_quantity <= 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label="Today" value={pkr(todayTotal)} />
        <Stat icon={TrendingUp} label="All-time sales" value={pkr(allTime)} />
        <Stat icon={Receipt} label="Transactions" value={String(sales.length)} />
        <Stat icon={AlertTriangle} label="Low stock" value={String(lowStock.length)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-base font-bold">Daily sales (last 14 days)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => pkrCompact(Number(v))} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v) => pkr(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="var(--color-brand)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-base font-bold">Weekly sales</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => pkrCompact(Number(v))} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v) => pkr(Number(v))} />
              <Bar dataKey="total" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-base font-bold">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {topProducts.map((p) => (
                <li key={p.title} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{p.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {p.quantity} sold · <span className="font-bold text-foreground">{pkr(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-base font-bold">Low stock alerts</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All products are well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{p.title}</span>
                  <Badge variant="destructive" className="shrink-0">
                    {p.stock_quantity} left
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-base font-bold">Transaction history</h2>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sales.slice(0, 25).map((sale) => (
              <li key={sale.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">Receipt #{sale.receipt_no}</p>
                  <p className="truncate text-xs text-muted-foreground">{dateTime(sale.created_at)}</p>
                </div>
                <span className="shrink-0 self-center font-bold">{pkr(sale.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="mt-2 truncate text-xl font-extrabold">{value}</p>
    </div>
  );
}
