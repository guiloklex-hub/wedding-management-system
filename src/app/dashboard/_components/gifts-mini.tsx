import Link from "next/link";
import { Gift } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/format";

export async function GiftsMini({
  totalCount,
  cashCount,
  cashTotal,
  thankedCount,
  thankedPct,
}: {
  totalCount: number;
  cashCount: number;
  cashTotal: number | null;
  thankedCount: number;
  thankedPct: number;
}) {
  const t = await getTranslations("dashboard.home");
  if (totalCount === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">{t("gifts.title")}</h2>
          <Gift className="h-4 w-4 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">{t("gifts.empty")}</p>
      </div>
    );
  }
  return (
    <Link
      href="/dashboard/reports/gifts"
      className="block rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm transition-colors hover:bg-zinc-800/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{t("gifts.title")}</h2>
        <Gift className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold text-zinc-100">{totalCount}</p>
          <p className="mt-1 break-words text-xs text-zinc-500">
            {t("gifts.breakdown", { cash: cashCount, items: totalCount - cashCount })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {cashTotal !== null ? (
            <p className="text-sm font-semibold text-emerald-300">{formatCurrency(cashTotal)}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-400">
            {t("gifts.thankedLabel")} <span className="font-semibold text-zinc-100">{Math.round(thankedPct * 100)}%</span>
          </p>
          <p className="text-[10px] text-zinc-500">{t("gifts.thankedCount", { thanked: thankedCount, total: totalCount })}</p>
        </div>
      </div>
    </Link>
  );
}
