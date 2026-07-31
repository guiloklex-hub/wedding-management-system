"use client";

import { useSession } from "next-auth/react";
import { canViewSensitiveFinance } from "@/lib/permissions";
import {
  Armchair,
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
  Send,
  Mail,
  Settings as SettingsIcon,
  ShoppingBasket,
  Target,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";

export type NavLink = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  finance?: boolean;
};

export const LINKS: NavLink[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: Home, exact: true },
  { href: "/dashboard/insights", labelKey: "nav.insights", icon: BarChart3, finance: true },
  { href: "/dashboard/reports", labelKey: "nav.reports", icon: BarChart3 },
  { href: "/dashboard/vendors", labelKey: "nav.vendors", icon: Users },
  { href: "/dashboard/venues", labelKey: "nav.venues", icon: Building2 },
  { href: "/dashboard/tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { href: "/dashboard/payments", labelKey: "nav.payments", icon: CreditCard, finance: true },
  { href: "/dashboard/income", labelKey: "nav.income", icon: PiggyBank, finance: true },
  { href: "/dashboard/assets", labelKey: "nav.assets", icon: Wallet, finance: true },
  { href: "/dashboard/goals", labelKey: "nav.goals", icon: Target, finance: true },
  { href: "/dashboard/guests", labelKey: "nav.guests", icon: UserPlus },
  { href: "/dashboard/save-the-date", labelKey: "nav.saveTheDate", icon: Send },
  { href: "/dashboard/invitations", labelKey: "nav.invitations", icon: Mail },
  { href: "/dashboard/gifts", labelKey: "nav.gifts", icon: Gift },
  { href: "/dashboard/wedding-day", labelKey: "nav.weddingDay", icon: CalendarHeart, exact: true },
  { href: "/dashboard/wedding-day/seating", labelKey: "nav.seating", icon: Armchair },
  { href: "/dashboard/honeymoon", labelKey: "nav.honeymoon", icon: Plane },
  { href: "/dashboard/trousseau", labelKey: "nav.trousseau", icon: ShoppingBasket },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: SettingsIcon },
  { href: "/dashboard/help", labelKey: "nav.help", icon: HelpCircle },
];

export const PRIMARY_HREFS = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/vendors",
  "/dashboard/guests",
] as const;

export type NavCategory = {
  id: "financial" | "wedding" | "people" | "system";
  labelKey: string;
  finance?: boolean;
  hrefs: string[];
};

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "financial",
    labelKey: "nav.cat.financial",
    finance: true,
    hrefs: [
      "/dashboard/insights",
      "/dashboard/reports",
      "/dashboard/payments",
      "/dashboard/income",
      "/dashboard/assets",
      "/dashboard/goals",
    ],
  },
  {
    id: "wedding",
    labelKey: "nav.cat.wedding",
    hrefs: [
      "/dashboard/wedding-day",
      "/dashboard/wedding-day/seating",
      "/dashboard/honeymoon",
      "/dashboard/trousseau",
    ],
  },
  {
    id: "people",
    labelKey: "nav.cat.people",
    hrefs: [
      "/dashboard/vendors",
      "/dashboard/venues",
      "/dashboard/guests",
      "/dashboard/save-the-date",
      "/dashboard/invitations",
      "/dashboard/gifts",
    ],
  },
  {
    id: "system",
    labelKey: "nav.cat.system",
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
