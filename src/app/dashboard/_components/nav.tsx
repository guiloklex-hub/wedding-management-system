"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarHeart,
  CheckSquare,
  CreditCard,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  PiggyBank,
  Plane,
  Settings as SettingsIcon,
  ShoppingBasket,
  Target,
  Users,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/app/actions/authActions";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/vendors", label: "Fornecedores", icon: Users },
  { href: "/dashboard/venues", label: "Locais", icon: Building2 },
  { href: "/dashboard/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/dashboard/payments", label: "Pagamentos", icon: CreditCard },
  { href: "/dashboard/income", label: "Receitas", icon: PiggyBank },
  { href: "/dashboard/assets", label: "Caixa", icon: Wallet },
  { href: "/dashboard/goals", label: "Metas", icon: Target },
  { href: "/dashboard/guests", label: "Convidados", icon: UserPlus },
  { href: "/dashboard/gifts", label: "Presentes", icon: Gift },
  { href: "/dashboard/wedding-day", label: "Dia D", icon: CalendarHeart },
  { href: "/dashboard/honeymoon", label: "Lua de mel", icon: Plane },
  { href: "/dashboard/trousseau", label: "Enxoval", icon: ShoppingBasket },
  { href: "/dashboard/settings", label: "Ajustes", icon: SettingsIcon },
  { href: "/dashboard/help", label: "Ajuda", icon: HelpCircle },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
          <Heart className="h-5 w-5 text-rose-500" />
        </div>
        <span className="font-semibold tracking-tight text-zinc-100">Wedding Finance</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href, l.exact);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-zinc-800/60 font-medium text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-100"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-rose-400" : ""}`} />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
            <Heart className="h-4 w-4 text-rose-500" />
          </div>
          <span className="font-semibold tracking-tight text-zinc-100">Wedding Finance</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col border-l border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <span className="font-semibold text-zinc-100">Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {LINKS.map((l) => {
                const active = isActive(pathname, l.href, l.exact);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-zinc-800/60 font-medium text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-rose-400" : ""}`} />
                    <span>{l.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-zinc-800 p-3">
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sair</span>
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const primary: NavLink[] = LINKS.slice(0, 4);
  return (
    <nav className="safe-pb fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {primary.map((l) => {
          const active = isActive(pathname, l.href, l.exact);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center justify-center py-2.5 text-[11px] transition-colors ${
                active ? "text-rose-400" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="mb-0.5 h-5 w-5" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
