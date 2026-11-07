"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Users } from "lucide-react";
import type { AnnouncementRow, AnnouncementSummary } from "@/lib/notifications/announcement-recipients";

export function RecipientPrelist({
  rows,
  summary,
  excluded,
  disabled,
  onToggle,
  onSetMany,
}: {
  rows: AnnouncementRow[];
  summary: AnnouncementSummary;
  excluded: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], include: boolean) => void;
}) {
  const t = useTranslations("dashboard.announcements.preList");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.memberNames.toLowerCase().includes(q));
  }, [rows, query]);

  const visibleKeys = visible.map((r) => r.key);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-rose-400" />
        <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-950 p-3">
          <div className="text-2xl font-bold text-white">{summary.pending}</div>
          <div className="text-xs text-zinc-500">{t("summary.messages")}</div>
        </div>
        <div className="rounded-xl bg-zinc-950 p-3">
          <div className="text-2xl font-bold text-emerald-300">{summary.guestsReached}</div>
          <div className="text-xs text-zinc-500">{t("summary.guests")}</div>
        </div>
        <div className="rounded-xl bg-zinc-950 p-3">
          <div className="text-2xl font-bold text-zinc-400">{summary.skipped}</div>
          <div className="text-xs text-zinc-500">{t("summary.skipped")}</div>
        </div>
        <div className="rounded-xl bg-zinc-950 p-3">
          <div className="text-2xl font-bold text-zinc-400">{summary.manualExcluded}</div>
          <div className="text-xs text-zinc-500">{t("summary.unchecked")}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          />
        </div>
        <button
          type="button"
          disabled={disabled || visible.length === 0}
          onClick={() => onSetMany(visibleKeys, true)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {t("checkAll")}
        </button>
        <button
          type="button"
          disabled={disabled || visible.length === 0}
          onClick={() => onSetMany(visibleKeys, false)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {t("uncheckAll")}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">{t("colInclude")}</span>
              </th>
              <th className="px-3 py-2">{t("colName")}</th>
              <th className="px-3 py-2">{t("colChannel")}</th>
              <th className="px-3 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const checked = !excluded.has(r.key);
              return (
                <tr key={r.key} className="border-t border-zinc-800/70">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onToggle(r.key)}
                      aria-label={t("toggleAria", { name: r.name })}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    <div className="font-medium text-zinc-200">
                      {r.name}
                      {r.refType === "GuestGroup" && (
                        <span className="ml-2 rounded-full border border-zinc-700 px-1.5 py-px text-[10px] text-zinc-400">
                          {t("family")}
                        </span>
                      )}
                    </div>
                    {r.memberNames !== r.name && <div className="text-zinc-500">{r.memberNames}</div>}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.plannedChannel ? t(`channel.${r.plannedChannel}`) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "PENDING" ? (
                      <span className="text-emerald-400">{t("ready")}</span>
                    ) : (
                      <span className="text-zinc-500">{t(`reason.${r.skipReason ?? "NO_CONTACT"}`)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-zinc-600">
                  {rows.length === 0 ? t("empty") : t("noMatch")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">{t("familyHint")}</p>
    </div>
  );
}
