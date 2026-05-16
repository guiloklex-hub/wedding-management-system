export type TrousseauStatusKey = "TO_BUY" | "BOUGHT" | "GIFTED";
export type TrousseauPriorityKey = "ESSENTIAL" | "NICE_TO_HAVE" | "LUXURY";
export type TrousseauRoomKey = string;

export type TrousseauProgress = {
  byRoom: Array<{
    room: TrousseauRoomKey;
    counts: Record<TrousseauStatusKey, number>;
    estimated: number;
    actual: number;
    total: number;
  }>;
  essentialsPending: number;
  totalEstimated: number;
  totalActual: number;
  totalCount: number;
  completionPct: number;
};

type TrousseauItemRow = {
  room: string;
  priority: string;
  status: string;
  estimatedPrice: number | null;
  actualPrice: number | null;
};

const STATUS_KEYS: TrousseauStatusKey[] = ["TO_BUY", "BOUGHT", "GIFTED"];

function emptyCounts(): Record<TrousseauStatusKey, number> {
  return { TO_BUY: 0, BOUGHT: 0, GIFTED: 0 };
}

export function buildTrousseauProgress(items: TrousseauItemRow[]): TrousseauProgress {
  const byRoomMap = new Map<
    string,
    { counts: Record<TrousseauStatusKey, number>; estimated: number; actual: number }
  >();

  let essentialsPending = 0;
  let totalEstimated = 0;
  let totalActual = 0;
  let completed = 0;

  for (const item of items) {
    const status = (STATUS_KEYS as readonly string[]).includes(item.status)
      ? (item.status as TrousseauStatusKey)
      : "TO_BUY";

    const entry = byRoomMap.get(item.room) ?? { counts: emptyCounts(), estimated: 0, actual: 0 };
    entry.counts[status] += 1;
    entry.estimated += item.estimatedPrice ?? 0;
    entry.actual += item.actualPrice ?? item.estimatedPrice ?? 0;
    byRoomMap.set(item.room, entry);

    totalEstimated += item.estimatedPrice ?? 0;
    totalActual += item.actualPrice ?? item.estimatedPrice ?? 0;

    if (status === "TO_BUY" && item.priority === "ESSENTIAL") essentialsPending += 1;
    if (status === "BOUGHT" || status === "GIFTED") completed += 1;
  }

  const byRoom = Array.from(byRoomMap.entries())
    .map(([room, m]) => ({
      room,
      counts: m.counts,
      estimated: m.estimated,
      actual: m.actual,
      total: m.counts.TO_BUY + m.counts.BOUGHT + m.counts.GIFTED,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    byRoom,
    essentialsPending,
    totalEstimated,
    totalActual,
    totalCount: items.length,
    completionPct: items.length === 0 ? 0 : completed / items.length,
  };
}
