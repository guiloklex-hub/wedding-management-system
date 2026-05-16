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
import { auth } from "@/auth";
import { canViewSensitiveFinance, canManageUsers } from "@/lib/permissions";

type ReportEntry = {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  finance?: boolean;
  adminOnly?: boolean;
  inInsights?: boolean;
};

const REPORTS: ReportEntry[] = [
  {
    href: "/dashboard/insights#scurve",
    title: "Curva S — Previsto vs Realizado",
    description:
      "Compara o pagamento previsto com o realizado ao longo do tempo, com banda de contingência.",
    icon: TrendingUp,
    finance: true,
    inInsights: true,
  },
  {
    href: "/dashboard/reports/vendor-funnel",
    title: "Funil de Fornecedores",
    description: "Acompanhe quantos estão em negociação, contratados e finalizados.",
    icon: Users2,
  },
  {
    href: "/dashboard/reports/risk",
    title: "Risk Radar",
    description: "Sinais vermelhos consolidados em um único painel.",
    icon: ShieldAlert,
  },
  {
    href: "/dashboard/reports/guests",
    title: "Convidados & RSVP",
    description: "Taxa de resposta, plus-ones, VIPs, distribuição por grupo e cidade.",
    icon: UserCheck,
  },
  {
    href: "/dashboard/reports/gifts",
    title: "Presentes",
    description: "CASH × ITEM, agradecimentos pendentes, top givers e cota da lua de mel.",
    icon: Gift,
  },
  {
    href: "/dashboard/insights#burndown",
    title: "Burndown de Tarefas",
    description: "Compare ritmo ideal vs real de tarefas concluídas até a data do evento.",
    icon: ClipboardList,
    inInsights: true,
  },
  {
    href: "/dashboard/reports/honeymoon",
    title: "Lua de Mel",
    description: "Status por etapa e financiamento pelos presentes via PIX.",
    icon: Plane,
    finance: true,
  },
  {
    href: "/dashboard/reports/trousseau",
    title: "Enxoval",
    description: "Progresso por cômodo e essenciais ainda pendentes.",
    icon: ShoppingBasket,
  },
  {
    href: "/dashboard/insights#waterfall",
    title: "Variação por Categoria",
    description: "Waterfall mostrando onde o orçamento estourou e quanto.",
    icon: Waves,
    finance: true,
    inInsights: true,
  },
  {
    href: "/dashboard/reports/activity",
    title: "Timeline de Atividade",
    description: "Últimas alterações relevantes registradas em auditoria.",
    icon: History,
    adminOnly: true,
  },
];

export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const session = await auth();
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
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Visualizações analíticas detalhadas por área. Os ícones BI dentro de
          /dashboard/insights também aparecem aqui como atalho.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <h2 className="text-sm font-semibold text-zinc-100">{r.title}</h2>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-rose-300" />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{r.description}</p>
                {r.inInsights ? (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-400">
                    <BarChart3 className="h-3 w-3" />
                    Em Insights
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
