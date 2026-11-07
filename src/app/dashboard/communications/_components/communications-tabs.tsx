"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive } from "../../_components/nav-links";

const TABS = [
  { key: "overview", href: "/dashboard/communications", exact: true },
  { key: "saveTheDate", href: "/dashboard/communications/save-the-date" },
  { key: "invitations", href: "/dashboard/communications/invitations" },
  { key: "announcements", href: "/dashboard/communications/announcements" },
] as const;

export function CommunicationsTabs() {
  const t = useTranslations("dashboard.communications.tabs");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("aria")}
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-zinc-800 px-1 pb-px"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href, "exact" in tab ? tab.exact : false);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-rose-400 font-medium text-rose-200"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
