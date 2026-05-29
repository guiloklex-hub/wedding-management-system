import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Gift,
  History,
  Plane,
  ShieldAlert,
  ShoppingBasket,
  TrendingUp,
  UserCheck,
  Users2,
  Waves,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { canViewSensitiveFinance, canManageUsers } from "@/lib/permissions";

type ReportEntry = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  finance?: boolean;
  adminOnly?: boolean;
  inInsights?: boolean;
};

const REPORTS: ReportEntry[] = [
  {
    key: "scurve",
    href: "/dashboard/insights#scurve",
    icon: TrendingUp,
    finance: true,
    inInsights: true,
  },
  {
    key: "vendorFunnel",
    href: "/dashboard/reports/vendor-funnel",
    icon: Users2,
  },
  {
    key: "risk",
    href: "/dashboard/reports/risk",
    icon: ShieldAlert,
  },
  {
    key: "guests",
    href: "/dashboard/reports/guests",
    icon: UserCheck,
  },
  {
    key: "gifts",
    href: "/dashboard/reports/gifts",
    icon: Gift,
  },
  {
    key: "burndown",
    href: "/dashboard/insights#burndown",
    icon: ClipboardList,
    inInsights: true,
  },
  {
    key: "honeymoon",
    href: "/dashboard/reports/honeymoon",
    icon: Plane,
    finance: true,
  },
  {
    key: "trousseau",
    href: "/dashboard/reports/trousseau",
    icon: ShoppingBasket,
  },
  {
    key: "waterfall",
    href: "/dashboard/insights#waterfall",
    icon: Waves,
    finance: true,
    inInsights: true,
  },
  {
    key: "activity",
    href: "/dashboard/reports/activity",
    icon: History,
    adminOnly: true,
  },
];

export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const session = await auth();
  const t = await getTranslations("dashboard.reports.hub");
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);
  const admin = canManageUsers(role);

  const visible = REPORTS.filter((r) => {
    if (r.adminOnly && !admin) return false;
    if (r.finance && !finance) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group flex h-full items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm transition-colors hover:bg-zinc-800/50"
            >
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2 text-rose-300 group-hover:text-rose-200">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    {t(`items.${r.key}.title`)}
                  </h2>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-rose-300" />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{t(`items.${r.key}.description`)}</p>
                {r.inInsights ? (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-400">
                    <BarChart3 className="h-3 w-3" />
                    {t("inInsights")}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
