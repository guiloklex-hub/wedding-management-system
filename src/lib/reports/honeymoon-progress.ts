export type HoneymoonStatusKey =
  | "PLANNED"
  | "BOOKED"
  | "CONFIRMED"
  | "PAID"
  | "CANCELLED";

export type HoneymoonProgress = {
  totals: Record<HoneymoonStatusKey, { amount: number; count: number }>;
  byKind: Array<{
    kind: string;
    counts: Record<HoneymoonStatusKey, number>;
    amount: number;
  }>;
  byCurrency: Record<string, number>;
  budgetBRL: number | null;
  paidBRL: number;
  bookedBRL: number;
  fundedFromGiftsBRL: number;
  fundedPct: number | null;
  itemsCount: number;
};

type HoneymoonRow = { budget: number | null; currency: string };
type HoneymoonItemRow = {
  kind: string;
  status: string;
  amount: number | null;
  currency: string;
};
type GiftRow = {
  type: string;
  amount: number | null;
  isHoneymoonShare: boolean;
};

const STATUS_KEYS: HoneymoonStatusKey[] = ["PLANNED", "BOOKED", "CONFIRMED", "PAID", "CANCELLED"];

function emptyStatusCounts(): Record<HoneymoonStatusKey, number> {
  return { PLANNED: 0, BOOKED: 0, CONFIRMED: 0, PAID: 0, CANCELLED: 0 };
}

function emptyTotals(): Record<HoneymoonStatusKey, { amount: number; count: number }> {
  return {
    PLANNED: { amount: 0, count: 0 },
    BOOKED: { amount: 0, count: 0 },
    CONFIRMED: { amount: 0, count: 0 },
    PAID: { amount: 0, count: 0 },
    CANCELLED: { amount: 0, count: 0 },
  };
}

export function buildHoneymoonProgress(
  honeymoon: HoneymoonRow | null,
  items: HoneymoonItemRow[],
  honeymoonGifts: GiftRow[],
): HoneymoonProgress {
  const totals = emptyTotals();
  const byKindMap = new Map<string, { counts: Record<HoneymoonStatusKey, number>; amount: number }>();
  const byCurrency: Record<string, number> = {};

  for (const item of items) {
    const status = (STATUS_KEYS as readonly string[]).includes(item.status)
      ? (item.status as HoneymoonStatusKey)
      : "PLANNED";
    totals[status].amount += item.amount ?? 0;
    totals[status].count += 1;

    const kindEntry = byKindMap.get(item.kind) ?? { counts: emptyStatusCounts(), amount: 0 };
    kindEntry.counts[status] += 1;
    if (status !== "CANCELLED") kindEntry.amount += item.amount ?? 0;
    byKindMap.set(item.kind, kindEntry);

    byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + (item.amount ?? 0);
  }

  const paidBRL = totals.PAID.amount;
  const bookedBRL = totals.BOOKED.amount + totals.CONFIRMED.amount + totals.PAID.amount;
  const fundedFromGiftsBRL = honeymoonGifts
    .filter((g) => g.isHoneymoonShare && g.type === "CASH")
    .reduce((s, g) => s + (g.amount ?? 0), 0);

  const budgetBRL =
    honeymoon && honeymoon.currency === "BRL" ? honeymoon.budget : null;

  const fundedPct =
    budgetBRL && budgetBRL > 0 ? Math.min(1, fundedFromGiftsBRL / budgetBRL) : null;

  const byKind = Array.from(byKindMap.entries())
    .map(([kind, m]) => ({ kind, counts: m.counts, amount: m.amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totals,
    byKind,
    byCurrency,
    budgetBRL,
    paidBRL,
    bookedBRL,
    fundedFromGiftsBRL,
    fundedPct,
    itemsCount: items.length,
  };
}
