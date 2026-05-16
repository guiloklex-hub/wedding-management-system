import { monthKey, monthLabel } from "./formatters";

export type GiftsAnalytics = {
  byType: { cash: number; item: number };
  totalCash: number;
  itemsCount: number;
  thankedPct: number;
  thankedCount: number;
  totalCount: number;
  honeymoonShareTotal: number;
  honeymoonShareCount: number;
  pixReceivedCount: number;
  topGivers: Array<{ name: string; total: number; count: number; type: "CASH" | "ITEM" | "MIXED" }>;
  weeklyAccum: Array<{ label: string; cumulative: number; count: number }>;
};

type GiftRow = {
  type: string;
  amount: number | null;
  receivedAt: Date | null;
  thankedAt: Date | null;
  pixPaidAt: Date | null;
  isHoneymoonShare: boolean;
  guestId: string | null;
  guest: { name: string } | null;
};

export function buildGiftsAnalytics(gifts: GiftRow[]): GiftsAnalytics {
  let cashCount = 0;
  let itemsCount = 0;
  let totalCash = 0;
  let thankedCount = 0;
  let honeymoonShareTotal = 0;
  let honeymoonShareCount = 0;
  let pixReceivedCount = 0;

  const giversMap = new Map<string, { name: string; total: number; count: number; types: Set<string> }>();
  const monthlyMap = new Map<string, { date: Date; cash: number; count: number }>();

  for (const g of gifts) {
    if (g.type === "CASH") {
      cashCount += 1;
      totalCash += g.amount ?? 0;
    } else {
      itemsCount += 1;
    }
    if (g.thankedAt) thankedCount += 1;
    if (g.pixPaidAt) pixReceivedCount += 1;
    if (g.isHoneymoonShare) {
      honeymoonShareCount += 1;
      if (g.type === "CASH") honeymoonShareTotal += g.amount ?? 0;
    }

    const giverName = g.guest?.name ?? "Convidado sem cadastro";
    const giverKey = g.guestId ?? `anon:${giverName}`;
    const cur = giversMap.get(giverKey) ?? { name: giverName, total: 0, count: 0, types: new Set<string>() };
    cur.count += 1;
    cur.total += g.type === "CASH" ? g.amount ?? 0 : 0;
    cur.types.add(g.type);
    giversMap.set(giverKey, cur);

    if (g.receivedAt) {
      const key = monthKey(g.receivedAt);
      const bucket = monthlyMap.get(key) ?? {
        date: new Date(Date.UTC(g.receivedAt.getUTCFullYear(), g.receivedAt.getUTCMonth(), 1)),
        cash: 0,
        count: 0,
      };
      if (g.type === "CASH") bucket.cash += g.amount ?? 0;
      bucket.count += 1;
      monthlyMap.set(key, bucket);
    }
  }

  const totalCount = cashCount + itemsCount;
  const thankedPct = totalCount > 0 ? thankedCount / totalCount : 0;

  const topGivers = Array.from(giversMap.values())
    .map((m) => {
      const types = Array.from(m.types);
      let kind: "CASH" | "ITEM" | "MIXED" = "CASH";
      if (types.length > 1) kind = "MIXED";
      else if (types[0] === "ITEM") kind = "ITEM";
      return { name: m.name, total: m.total, count: m.count, type: kind };
    })
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, 10);

  const weeklyAccum: GiftsAnalytics["weeklyAccum"] = [];
  let cumulative = 0;
  let runningCount = 0;
  for (const bucket of Array.from(monthlyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime())) {
    cumulative += bucket.cash;
    runningCount += bucket.count;
    weeklyAccum.push({ label: monthLabel(bucket.date), cumulative, count: runningCount });
  }

  return {
    byType: { cash: cashCount, item: itemsCount },
    totalCash,
    itemsCount,
    thankedPct,
    thankedCount,
    totalCount,
    honeymoonShareTotal,
    honeymoonShareCount,
    pixReceivedCount,
    topGivers,
    weeklyAccum,
  };
}
