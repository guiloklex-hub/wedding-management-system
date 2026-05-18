"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Drawer } from "vaul";
import { Heart, LayoutGrid, LogOut } from "lucide-react";
import { logout } from "@/app/actions/authActions";
import {
  NAV_CATEGORIES,
  PRIMARY_HREFS,
  findLink,
  isActive,
  useCanViewFinance,
} from "./nav-links";

const SWIPE_OPEN_THRESHOLD_PX = 50;

export function MobileTopBar() {
  const t = useTranslations("common.nav");
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
        <Heart className="h-4 w-4 text-rose-500" />
      </div>
      <span className="font-semibold tracking-tight text-zinc-100">{t("appTitle")}</span>
    </div>
  );
}

export function MobileNav() {
  const t = useTranslations("common.nav");
  const pathname = usePathname();
  const canFinance = useCanViewFinance();
  const [open, setOpen] = useState(false);

  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    startY.current = touch.clientY;
    startTime.current = performance.now();
  }, []);

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (startY.current === null || open) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaY = startY.current - touch.clientY;
      if (deltaY > SWIPE_OPEN_THRESHOLD_PX) {
        startY.current = null;
        setOpen(true);
      }
    },
    [open],
  );

  const onTouchEnd = useCallback(() => {
    startY.current = null;
  }, []);

  const primaryLinks = PRIMARY_HREFS.map((href) => findLink(href)).filter(
    (link): link is NonNullable<typeof link> => Boolean(link),
  );

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <nav
        aria-label={t("primaryAria")}
        className="safe-pb fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden"
      >
        <button
          type="button"
          aria-label={t("swipeOpen")}
          onClick={() => setOpen(true)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className="group absolute -top-3 left-1/2 z-10 flex h-6 w-20 -translate-x-1/2 items-center justify-center"
          style={{ touchAction: "pan-x" }}
        >
          <span className="block h-1 w-12 rounded-full bg-zinc-700 transition-colors group-hover:bg-zinc-500 group-active:bg-zinc-400" />
        </button>

        <div className="grid grid-cols-5">
          {primaryLinks.map((link) => {
            const active = isActive(pathname, link.href, link.exact);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-2.5 text-[11px] transition-colors ${
                  active ? "text-rose-400" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="mb-0.5 h-5 w-5" />
                <span>{t(link.labelKey.replace(/^nav\./, ""))}</span>
              </Link>
            );
          })}

          <Drawer.Trigger asChild>
            <button
              type="button"
              aria-label={t("openMenu")}
              aria-expanded={open}
              aria-controls="mobile-menu-sheet"
              className={`flex flex-col items-center justify-center py-2.5 text-[11px] transition-colors ${
                open ? "text-rose-400" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="mb-0.5 h-5 w-5" />
              <span>{t("more")}</span>
            </button>
          </Drawer.Trigger>
        </div>
      </nav>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />
        <Drawer.Content
          id="mobile-menu-sheet"
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950 outline-none md:hidden"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-zinc-700" />
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 pb-3 pt-2">
            <Drawer.Title className="text-base font-semibold text-zinc-100">{t("menu")}</Drawer.Title>
            <Drawer.Description className="sr-only">{t("drawerHelp")}</Drawer.Description>
          </div>

          <div
            className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
          >
            {NAV_CATEGORIES.map((category) => {
              if (category.finance && !canFinance) return null;
              const links = category.hrefs
                .map((href) => findLink(href))
                .filter((link): link is NonNullable<typeof link> => Boolean(link));
              if (links.length === 0) return null;

              return (
                <div key={category.id} className="pt-4">
                  <h3 className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {t(category.labelKey.replace(/^nav\./, ""))}
                  </h3>
                  <ul className="space-y-1">
                    {links.map((link) => {
                      const active = isActive(pathname, link.href, link.exact);
                      const Icon = link.icon;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                              active
                                ? "bg-zinc-800/60 font-medium text-zinc-100"
                                : "text-zinc-300 hover:bg-zinc-800/50"
                            }`}
                          >
                            <Icon className={`h-5 w-5 ${active ? "text-rose-400" : ""}`} />
                            <span>{t(link.labelKey.replace(/^nav\./, ""))}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="mt-6 border-t border-zinc-800 pt-3">
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-rose-400 transition-colors hover:bg-rose-500/10"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{t("logout")}</span>
                </button>
              </form>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
