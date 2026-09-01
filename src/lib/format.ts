export function pkr(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `Rs. ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pkrCompact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rs. ${(n / 1_000).toFixed(1)}k`;
  return `Rs. ${n.toFixed(0)}`;
}

export function dateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
