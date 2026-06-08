import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Gift,
  ListTodo,
  Sparkles,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ActionItem, ActionKind } from "@/lib/action-stream";
import { formatCurrency } from "@/lib/format";

const MAX_VISIBLE = 10;

const KIND_STYLE: Record<ActionKind, { icon: typeof CreditCard; tone: string }> = {
  PAYMENT_OVERDUE: { icon: CreditCard, tone: "text-rose-300" },
  PAYMENT_DUE: { icon: CreditCard, tone: "text-amber-300" },
  TASK_OVERDUE: { icon: ListTodo, tone: "text-rose-300" },
  TASK_DUE: { icon: ListTodo, tone: "text-amber-300" },
  CONTRACT_EXPIRING: { icon: FileText, tone: "text-amber-300" },
  RSVP_PENDING: { icon: Users, tone: "text-sky-300" },
  GIFT_THANK: { icon: Gift, tone: "text-sky-300" },
};

const OVERDUE_KINDS = new Set<ActionKind>(["PAYMENT_OVERDUE", "TASK_OVERDUE"]);
const DUE_KINDS = new Set<ActionKind>(["PAYMENT_DUE", "TASK_DUE", "CONTRACT_EXPIRING"]);

export async function ActionStreamCard({
  items,
  canSeeFinance,
}: {
  items: ActionItem[];
  canSeeFinance: boolean;
}) {
  const t = await getTranslations("dashboard.home.actionStream");

  const visible = items.filter((i) => (i.finance ? canSeeFinance : true));
  const shown = visible.slice(0, MAX_VISIBLE);
  const more = visible.length - shown.length;

  function titleFor(item: ActionItem): string {
    const p = item.params;
    switch (item.kind) {
      case "PAYMENT_OVERDUE":
      case "PAYMENT_DUE":
        return t(`kind.${item.kind}`, {
          vendor: String(p.vendor),
          amount: formatCurrency(Number(p.amount)),
        });
      case "TASK_OVERDUE":
      case "TASK_DUE":
        return t(`kind.${item.kind}`, { title: String(p.title) });
      case "CONTRACT_EXPIRING":
        return t("kind.CONTRACT_EXPIRING", { vendor: String(p.vendor) });
      case "RSVP_PENDING":
      case "GIFT_THANK":
        return t(`kind.${item.kind}`, { count: Number(p.count) });
    }
  }

  function metaFor(item: ActionItem): string | null {
    const days = Number(item.params.days);
    if (OVERDUE_KINDS.has(item.kind)) return t("overdueBy", { days });
    if (DUE_KINDS.has(item.kind)) return days === 0 ? t("dueToday") : t("dueIn", { days });
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-rose-400" />
        <h2 className="text-sm font-semibold text-zinc-200">{t("title")}</h2>
        {visible.length > 0 ? (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            {visible.length}
          </span>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-200">{t("empty")}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {shown.map((item) => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;
              const meta = metaFor(item);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-800/40 p-3 transition-colors hover:bg-zinc-800"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${style.tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{titleFor(item)}</span>
                    {meta ? (
                      <span className={`shrink-0 text-xs ${style.tone}`}>{meta}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {more > 0 ? (
            <p className="mt-3 text-center text-xs text-zinc-500">{t("more", { count: more })}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
