"use client";

import { useTranslations } from "next-intl";
import type { ClassifiedRow } from "@/app/actions/guestActions";

const STATUS_KEY: Record<ClassifiedRow["classification"], string> = {
  new: "table.statusNew",
  duplicate_same: "table.statusDuplicateSame",
  duplicate_diff: "table.statusDuplicateDiff",
};

const STATUS_CHIP: Record<ClassifiedRow["classification"], string> = {
  new: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  duplicate_same: "bg-zinc-800 text-zinc-400 border-zinc-700",
  duplicate_diff: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

const RSVP_KEY: Record<string, string> = {
  NOT_INVITED: "rsvp.notInvited",
  INVITED: "rsvp.invited",
  CONFIRMED: "rsvp.confirmed",
  DECLINED: "rsvp.declined",
  MAYBE: "rsvp.maybe",
};

export function PreviewTable({
  rows,
  filter,
}: {
  rows: ClassifiedRow[];
  filter: "all" | ClassifiedRow["classification"];
}) {
  const t = useTranslations("dashboard.guests.import");
  const tg = useTranslations("dashboard.guests");
  const rsvpLabel = (status: string) => (RSVP_KEY[status] ? tg(RSVP_KEY[status]) : status);
  const visible = filter === "all" ? rows : rows.filter((r) => r.classification === filter);

  if (visible.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-950 px-3 py-6 text-center text-sm text-zinc-500">
        {t("table.noRowsForFilter")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-xs text-zinc-400">
        <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">{t("table.status")}</th>
            <th className="px-3 py-2 font-medium">{t("table.name")}</th>
            <th className="px-3 py-2 font-medium">{t("table.group")}</th>
            <th className="px-3 py-2 font-medium">{t("table.rsvp")}</th>
            <th className="px-3 py-2 font-medium">{t("table.phone")}</th>
            <th className="px-3 py-2 font-medium">{t("table.email")}</th>
            <th className="px-3 py-2 font-medium">{t("table.tags")}</th>
            <th className="px-3 py-2 font-medium">{t("table.child")}</th>
            <th className="px-3 py-2 font-medium">{t("table.pin")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {visible.map((row, idx) => (
            <tr key={`${row.name}-${idx}`} className="hover:bg-zinc-900/60">
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CHIP[row.classification]}`}
                >
                  {t(STATUS_KEY[row.classification])}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-100">{row.name}</td>
              <td className="px-3 py-2">{row.groupName ?? "—"}</td>
              <td className="px-3 py-2">
                {rsvpLabel(row.rsvpStatus)}
                {row.rsvpStatusRaw && row.rsvpStatus === "INVITED" && row.rsvpStatusRaw !== "Sem resposta" ? (
                  <span
                    className="ml-1 text-[10px] text-amber-400"
                    title={t("table.rawStatusHint", { raw: row.rsvpStatusRaw })}
                  >
                    *
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">{row.phone ?? "—"}</td>
              <td className="px-3 py-2">{row.email ?? "—"}</td>
              <td className="px-3 py-2">
                {row.tags.length > 0 ? row.tags.join(", ") : "—"}
              </td>
              <td className="px-3 py-2">
                {row.isChild
                  ? row.age != null
                    ? t("table.childYesAge", { age: row.age })
                    : t("table.childYes")
                  : "—"}
              </td>
              <td className="px-3 py-2">{row.pin ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
