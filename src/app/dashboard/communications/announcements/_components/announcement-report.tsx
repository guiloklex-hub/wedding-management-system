"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Download, RotateCcw, XCircle } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  cancelAnnouncement,
  duplicateAnnouncement,
  exportAnnouncementCsv,
  getAnnouncementProgress,
  getAnnouncementRecipients,
  resendFailedAnnouncement,
  type AnnouncementProgress,
  type AnnouncementRecipientRow,
} from "@/app/actions/announcementActions";
import type { Audience, AnnouncementChannel } from "@/lib/notifications/announcement-config";
import type { EditorTag } from "./audience-filters";

type Props = {
  id: string;
  title: string;
  message: string;
  channel: AnnouncementChannel;
  audience: Audience;
  tags: EditorTag[];
  hasArt: boolean;
  initialProgress: AnnouncementProgress;
  initialRows: AnnouncementRecipientRow[];
  canManage: boolean;
};

const card = "space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl";

export function AnnouncementReport({
  id,
  title,
  message,
  channel,
  audience,
  tags,
  hasArt,
  initialProgress,
  initialRows,
  canManage,
}: Props) {
  const t = useTranslations("dashboard.announcements.report");
  const tStatus = useTranslations("dashboard.announcements.status");
  const tEditor = useTranslations("dashboard.announcements.editor");
  const tAud = useTranslations("dashboard.announcements.audience");
  const tPre = useTranslations("dashboard.announcements.preList");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [progress, setProgress] = useState(initialProgress);
  const [rows, setRows] = useState<AnnouncementRecipientRow[]>(initialRows);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "resendUnknown">(null);

  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([getAnnouncementProgress(id), getAnnouncementRecipients(id)]);
    if (p) setProgress(p);
    if (r) setRows(r);
  }, [id]);

  useEffect(() => {
    if (progress.status !== "SENDING") return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [progress.status, refresh]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const resend = (confirmUnknown: boolean) =>
    run(async () => {
      const res = await resendFailedAnnouncement(id, confirmUnknown);
      setConfirm(null);
      if (!res.success) {
        toast.error(tc("common.errorGeneric"), res.error);
        return;
      }
      if (res.data) setProgress(res.data);
      toast.success(t("toasts.resent"));
      await refresh();
    });

  const handleCancel = () =>
    run(async () => {
      const res = await cancelAnnouncement(id);
      setConfirm(null);
      if (!res.success) {
        toast.error(tc("common.errorGeneric"), res.error);
        return;
      }
      toast.success(t("toasts.cancelled"));
      await refresh();
    });

  const handleCsv = () =>
    run(async () => {
      const res = await exportAnnouncementCsv(id);
      if (!res.success || !res.data) {
        toast.error(tc("common.errorGeneric"), res.success ? undefined : res.error);
        return;
      }
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${t("csvFileName")}-${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const handleDuplicate = () =>
    run(async () => {
      const res = await duplicateAnnouncement(id);
      if (!res.success || !res.data) {
        toast.error(tc("common.errorGeneric"), res.success ? undefined : res.error);
        return;
      }
      router.push(`/dashboard/communications/announcements/${res.data.id}`);
    });

  const done = progress.sent + progress.failed + progress.skipped;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const tagName = (tagId: string) => tags.find((x) => x.id === tagId)?.name ?? tagId;

  const audienceChips = [
    ...audience.rsvpStatuses.map((s) => tAud(`rsvp.${s}`)),
    ...audience.includeTagIds.map((id) => t("audience.include", { tag: tagName(id) })),
    ...audience.excludeTagIds.map((id) => t("audience.exclude", { tag: tagName(id) })),
    ...audience.sides.map((s) => tAud(`side.${s}`)),
    ...(audience.padrinhos !== "ALL" ? [tAud(`padrinhos.${audience.padrinhos}`)] : []),
  ];

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">{t("progressTitle")}</h2>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            {tStatus(progress.status)}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          {(["pending", "sent", "failed", "skipped"] as const).map((k) => (
            <div key={k} className="rounded-xl bg-zinc-950 p-3">
              <div className="text-2xl font-bold text-white">{progress[k]}</div>
              <div className="text-xs text-zinc-500">{t(`metrics.${k}`)}</div>
            </div>
          ))}
        </div>
        {progress.queuedBehind > 0 && (
          <p className="text-xs text-amber-300/80">{t("queued", { count: progress.queuedBehind })}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {canManage && progress.failed > 0 && progress.status !== "SENDING" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => (progress.unknown > 0 ? setConfirm("resendUnknown") : resend(false))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("actions.resend", { count: progress.failed })}
            </button>
          )}
          {canManage && progress.status === "SENDING" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm("cancel")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t("actions.cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t("actions.csv")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("actions.duplicate")}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-semibold text-white">{t("messageTitle")}</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">{tEditor("compose.subjectLabel")}</dt>
              <dd className="text-zinc-200">{title}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">{tEditor("channel.title")}</dt>
              <dd className="text-zinc-200">{tEditor(`channel.${channel}.label`)}</dd>
            </div>
            {hasArt && (
              <div>
                <dt className="text-xs text-zinc-500">{tEditor("compose.artLabel")}</dt>
                <dd>
                  <a
                    href={`/api/announcements/${id}/art`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-300 underline"
                  >
                    {t("viewArt")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-zinc-950 p-3 text-sm text-zinc-300">{message}</p>
          <div className="flex flex-wrap gap-1.5">
            {audienceChips.map((c) => (
              <span key={c} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
                {c}
              </span>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-semibold text-white">{t("recipientsTitle")}</h2>
          <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{tPre("colName")}</th>
                  <th className="px-3 py-2">{tPre("colChannel")}</th>
                  <th className="px-3 py-2">{tPre("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-200">{r.name}</div>
                      {r.memberNames !== r.name && <div className="text-zinc-500">{r.memberNames}</div>}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {r.channelUsed === "WHATSAPP" || r.channelUsed === "EMAIL"
                        ? tPre(`channel.${r.channelUsed}`)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "SENT"
                            ? "text-emerald-400"
                            : r.status === "FAILED"
                              ? "text-rose-400"
                              : "text-zinc-500"
                        }
                      >
                        {t(`recipientStatus.${r.status}`)}
                      </span>
                      {r.error && (
                        <div className="text-zinc-500">
                          {t.has(`reason.${r.error}`)
                            ? t(`reason.${r.error}`)
                            : tPre.has(`reason.${r.error}`)
                              ? tPre(`reason.${r.error}`)
                              : r.error}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-zinc-600">
                      {tPre("empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirm === "cancel"}
        tone="danger"
        title={t("confirmCancel.title")}
        description={t("confirmCancel.description", { count: progress.pending })}
        confirmLabel={t("confirmCancel.confirm")}
        cancelLabel={tc("actions.cancel")}
        busy={busy}
        onConfirm={handleCancel}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "resendUnknown"}
        title={t("confirmResend.title")}
        description={t("confirmResend.description", { count: progress.unknown })}
        confirmLabel={t("confirmResend.confirm")}
        cancelLabel={tc("actions.cancel")}
        busy={busy}
        onConfirm={() => resend(true)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
