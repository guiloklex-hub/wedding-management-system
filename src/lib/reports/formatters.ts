export function compactCurrencyBRL(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${Math.round(value)}`;
}

export function percent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function safePct(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function monthLabel(d: Date): string {
  return `${MONTHS_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
