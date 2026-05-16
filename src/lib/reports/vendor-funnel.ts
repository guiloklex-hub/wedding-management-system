export type VendorStatusKey = "NEGOTIATION" | "CONTRACTED" | "FINALIZED";

export type VendorFunnelResult = {
  totals: Record<VendorStatusKey, number>;
  perCategory: Array<{
    categoryKey: string | null;
    categoryLabel: string;
    counts: Record<VendorStatusKey, number>;
    total: number;
  }>;
  avgDaysNegToContract: number | null;
  avgDaysContractToFinalized: number | null;
};

type VendorRow = {
  status: string;
  categoryKey: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  contracts: Array<{ signedAt: Date | null; createdAt: Date }>;
};

const STATUS_KEYS: VendorStatusKey[] = ["NEGOTIATION", "CONTRACTED", "FINALIZED"];

function emptyCounts(): Record<VendorStatusKey, number> {
  return { NEGOTIATION: 0, CONTRACTED: 0, FINALIZED: 0 };
}

export function buildVendorFunnel(
  vendors: VendorRow[],
  resolveLabel: (key: string | null, fallback: string) => string,
): VendorFunnelResult {
  const totals = emptyCounts();
  const byCat = new Map<string, ReturnType<VendorFunnelResult["perCategory"][number]["counts"] extends infer T ? () => T : never>>();
  const catMeta = new Map<string, { key: string | null; label: string; counts: Record<VendorStatusKey, number> }>();

  const negToContractDays: number[] = [];
  const contractToFinalDays: number[] = [];

  for (const v of vendors) {
    const status = (STATUS_KEYS as readonly string[]).includes(v.status)
      ? (v.status as VendorStatusKey)
      : "NEGOTIATION";
    totals[status] += 1;

    const label = resolveLabel(v.categoryKey, v.category);
    const meta = catMeta.get(label) ?? {
      key: v.categoryKey,
      label,
      counts: emptyCounts(),
    };
    meta.counts[status] += 1;
    catMeta.set(label, meta);

    const firstSign = v.contracts
      .map((c) => c.signedAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (firstSign) {
      const negDays = (firstSign.getTime() - v.createdAt.getTime()) / 86400000;
      if (negDays >= 0) negToContractDays.push(negDays);
      if (status === "FINALIZED") {
        const finDays = (v.updatedAt.getTime() - firstSign.getTime()) / 86400000;
        if (finDays >= 0) contractToFinalDays.push(finDays);
      }
    }
    void byCat;
  }

  const perCategory = Array.from(catMeta.values())
    .map((m) => ({
      categoryKey: m.key,
      categoryLabel: m.label,
      counts: m.counts,
      total: m.counts.NEGOTIATION + m.counts.CONTRACTED + m.counts.FINALIZED,
    }))
    .sort((a, b) => b.total - a.total);

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10;

  return {
    totals,
    perCategory,
    avgDaysNegToContract: avg(negToContractDays),
    avgDaysContractToFinalized: avg(contractToFinalDays),
  };
}
