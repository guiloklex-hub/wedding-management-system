"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart, LogOut } from "lucide-react";
import { logout } from "@/app/actions/authActions";
import { isActive, useVisibleLinks } from "./nav-links";

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const visibleLinks = useVisibleLinks();
  return (
    <aside className="hidden w-64 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
          <Heart className="h-5 w-5 text-rose-500" />
        </div>
        <span className="font-semibold tracking-tight text-zinc-100">{t("appTitle")}</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {visibleLinks.map((l) => {
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
              <span>{t(l.labelKey.replace(/^nav\./, ""))}</span>
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
            <span>{t("logout")}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
