export type RsvpStatusKey = "INVITED" | "CONFIRMED" | "DECLINED" | "MAYBE";

export type GuestsAnalytics = {
  byStatus: Record<RsvpStatusKey, number>;
  totalInvited: number;
  totalConfirmed: number;
  totalDeclined: number;
  totalMaybe: number;
  totalPending: number;
  plusOnesAllowed: number;
  plusOnesConfirmed: number;
  effectiveConfirmed: number;
  byGroup: Array<{
    groupId: string | null;
    groupName: string;
    counts: Record<RsvpStatusKey, number>;
    total: number;
  }>;
  byCity: Array<{ city: string; count: number }>;
  vipsConfirmed: number;
  padrinhosConfirmed: number;
  children: number;
};

type GuestRow = {
  rsvpStatus: string;
  plusOnesAllowed: number;
  plusOnesConfirmed: number;
  isChild: boolean;
  isVIP: boolean;
  isPadrinho: boolean;
  city: string | null;
  groupId: string | null;
};

type GroupRow = { id: string; name: string };

const STATUS_KEYS: RsvpStatusKey[] = ["INVITED", "CONFIRMED", "DECLINED", "MAYBE"];

function emptyCounts(): Record<RsvpStatusKey, number> {
  return { INVITED: 0, CONFIRMED: 0, DECLINED: 0, MAYBE: 0 };
}

export function buildGuestsAnalytics(
  guests: GuestRow[],
  groups: GroupRow[],
): GuestsAnalytics {
  const byStatus = emptyCounts();
  const groupMap = new Map<string, { groupName: string; counts: Record<RsvpStatusKey, number> }>();
  groupMap.set("__ungrouped__", { groupName: "Sem grupo", counts: emptyCounts() });
  for (const g of groups) {
    groupMap.set(g.id, { groupName: g.name, counts: emptyCounts() });
  }

  const cityCounts = new Map<string, number>();
  let plusOnesAllowed = 0;
  let plusOnesConfirmed = 0;
  let vipsConfirmed = 0;
  let padrinhosConfirmed = 0;
  let children = 0;

  for (const g of guests) {
    const status = (STATUS_KEYS as readonly string[]).includes(g.rsvpStatus)
      ? (g.rsvpStatus as RsvpStatusKey)
      : "INVITED";
    byStatus[status] += 1;

    const key = g.groupId ?? "__ungrouped__";
    const entry = groupMap.get(key) ?? groupMap.get("__ungrouped__")!;
    entry.counts[status] += 1;

    plusOnesAllowed += g.plusOnesAllowed ?? 0;
    plusOnesConfirmed += g.plusOnesConfirmed ?? 0;
    if (g.isChild) children += 1;
    if (status === "CONFIRMED") {
      if (g.isVIP) vipsConfirmed += 1;
      if (g.isPadrinho) padrinhosConfirmed += 1;
    }

    const city = g.city?.trim();
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  const byGroup = Array.from(groupMap.entries())
    .map(([id, m]) => ({
      groupId: id === "__ungrouped__" ? null : id,
      groupName: m.groupName,
      counts: m.counts,
      total: m.counts.INVITED + m.counts.CONFIRMED + m.counts.DECLINED + m.counts.MAYBE,
    }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);

  const byCity = Array.from(cityCounts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  return {
    byStatus,
    totalInvited: byStatus.INVITED + byStatus.CONFIRMED + byStatus.DECLINED + byStatus.MAYBE,
    totalConfirmed: byStatus.CONFIRMED,
    totalDeclined: byStatus.DECLINED,
    totalMaybe: byStatus.MAYBE,
    totalPending: byStatus.INVITED,
    plusOnesAllowed,
    plusOnesConfirmed,
    effectiveConfirmed: byStatus.CONFIRMED + plusOnesConfirmed,
    byGroup,
    byCity,
    vipsConfirmed,
    padrinhosConfirmed,
    children,
  };
}
