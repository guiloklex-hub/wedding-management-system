"use client";

import { useSession } from "next-auth/react";
import { canViewSensitiveFinance } from "@/lib/permissions";
import {
  BarChart3,
  Building2,
  CalendarHeart,
  CheckSquare,
  CreditCard,
  Gift,
  HelpCircle,
  Home,
  PiggyBank,
  Plane,
  Settings as SettingsIcon,
  ShoppingBasket,
  Target,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  finance?: boolean;
};

export const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3, finance: true },
  { href: "/dashboard/vendors", label: "Fornecedores", icon: Users },
  { href: "/dashboard/venues", label: "Locais", icon: Building2 },
  { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/payments", label: "Pagamentos", icon: CreditCard, finance: true },
  { href: "/dashboard/income", label: "Receitas", icon: PiggyBank, finance: true },
  { href: "/dashboard/assets", label: "Caixa", icon: Wallet, finance: true },
  { href: "/dashboard/goals", label: "Metas", icon: Target, finance: true },
  { href: "/dashboard/guests", label: "Convidados", icon: UserPlus },
  { href: "/dashboard/gifts", label: "Presentes", icon: Gift },
  { href: "/dashboard/wedding-day", label: "Dia D", icon: CalendarHeart },
  { href: "/dashboard/honeymoon", label: "Lua de mel", icon: Plane },
  { href: "/dashboard/trousseau", label: "Enxoval", icon: ShoppingBasket },
  { href: "/dashboard/settings", label: "Ajustes", icon: SettingsIcon },
  { href: "/dashboard/help", label: "Ajuda", icon: HelpCircle },
];

export const PRIMARY_HREFS = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/vendors",
  "/dashboard/guests",
] as const;

export type NavCategory = {
  id: "financial" | "wedding" | "people" | "system";
  label: string;
  finance?: boolean;
  hrefs: string[];
};

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "financial",
    label: "Financeiro",
    finance: true,
    hrefs: [
      "/dashboard/insights",
      "/dashboard/payments",
      "/dashboard/income",
      "/dashboard/assets",
      "/dashboard/goals",
    ],
  },
  {
    id: "wedding",
    label: "Casamento",
    hrefs: ["/dashboard/wedding-day", "/dashboard/honeymoon", "/dashboard/trousseau"],
  },
  {
    id: "people",
    label: "Pessoas & Negócios",
    hrefs: [
      "/dashboard/vendors",
      "/dashboard/venues",
      "/dashboard/guests",
      "/dashboard/gifts",
    ],
  },
  {
    id: "system",
    label: "Sistema",
    hrefs: ["/dashboard/settings", "/dashboard/help"],
  },
];

export function useVisibleLinks(): NavLink[] {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canFinance = canViewSensitiveFinance(role);
  return LINKS.filter((l) => !l.finance || canFinance);
}

export function useCanViewFinance(): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return canViewSensitiveFinance(role);
}

export function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findLink(href: string): NavLink | undefined {
  return LINKS.find((l) => l.href === href);
}
