"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Download,
  FileText,
  Globe,
  Gift,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { interpolateBaseTags, applySiteTags } from "@/lib/notifications/std-message";
import {
  saveSaveTheDateConfig,
  sendTestSaveTheDate,
  startSaveTheDateBroadcast,
  resendFailedSaveTheDate,
  cancelSaveTheDateBroadcast,
  getSaveTheDateBroadcastProgress,
  getSaveTheDateBroadcastRecipients,
  type BroadcastProgress,
  type RecipientPreviewRow,
  type BroadcastRecipientRow,
} from "@/app/actions/saveTheDateActions";

type TagOption = { id: string; name: string; color: string | null };

type Props = {
  config: {
    weddingWebsiteUrl: string;
    giftRegistryUrl: string;
    saveTheDateMessage: string;
    hasArt: boolean;
    artName: string | null;
    artIsImage: boolean;
    excludeTagIds: string[];
    excludePadrinhos: boolean;
  };
  tags: TagOption[];
  event: {
    coupleNames: string;
    eventDateStr: string | null;
    venueName: string | null;
    configured: boolean;
  };
  recipients: {
    eligible: number;
    skipped: number;
    sampleNames: string | null;
    list: RecipientPreviewRow[];
  };
  capabilities: { whatsappConnected: boolean; hasUserPhone: boolean; hasUserEmail: boolean };
  activeBroadcast: BroadcastProgress | null;
};

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50";

const MERGE_VARS = ["nomes", "convidados", "data", "local", "site", "site-presentes"] as const;

function csvCell(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function SaveTheDateClient({
  config,
  tags,
  event,
  recipients,
  capabilities,
  activeBroadcast,
}: Props) {
  const t = useTranslations("dashboard.saveTheDate");
  const tc = useTranslations("common");
  const tn = useTranslations("notifications.SAVE_THE_DATE");
  const toast = useToast();

  const [message, setMessage] = useState(config.saveTheDateMessage);
  const [website, setWebsite] = useState(config.weddingWebsiteUrl);
  const [registry, setRegistry] = useState(config.giftRegistryUrl);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [configState, configAction, configPending] = useActionState(saveSaveTheDateConfig, undefined);

  const [testState, testAction, testPending] = useActionState(sendTestSaveTheDate, undefined);

  const [progress, setProgress] = useState<BroadcastProgress | null>(activeBroadcast);
  const [busy, setBusy] = useState(false);
  const sendingRef = useRef(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);

  const [detail, setDetail] = useState<BroadcastRecipientRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (configState?.success) {
      toast.success(t("toasts.configSaved"));
      window.location.reload();
    } else if (configState && !configState.success) {
      toast.error(tc("common.errorGeneric"), configState.error);
    }
  }, [configState, t, tc, toast]);

  useEffect(() => {
    if (testState?.success) {
      toast.success(t("toasts.testSent"));
    } else if (testState && !testState.success) {
      toast.error(tc("common.errorGeneric"), testState.error);
    }
  }, [testState, t, tc, toast]);

  useEffect(() => {
    if (!progress || progress.status !== "SENDING") return;
    const id = progress.id;
    const timer = setInterval(async () => {
      const next = await getSaveTheDateBroadcastProgress(id);
      if (next) setProgress(next);
    }, 3000);
    return () => clearInterval(timer);
  }, [progress]);

  const insertVar = useCallback(
    (name: string) => {
      const token = `{${name}}`;
      const el = messageRef.current;
      if (!el) {
        setMessage((m) => m + token);
        return;
      }
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const next = message.slice(0, start) + token + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [message],
  );

  const previewBody = useMemo(() => {
    const sample = recipients.sampleNames ?? (event.coupleNames || tc("appTitle"));
    const baseTags = {
      nomes: event.coupleNames,
      convidados: sample,
      data: event.eventDateStr ?? "",
      local: event.venueName ?? "",
    };
    const custom = message.trim();
    const core = custom
      ? interpolateBaseTags(custom, baseTags)
      : [
          tn("greeting", { guests: sample }),
          "",
          tn("announce", { names: event.coupleNames }),
          event.venueName
            ? tn("whenWhere", { date: event.eventDateStr ?? "", venue: event.venueName })
            : tn("when", { date: event.eventDateStr ?? "" }),
          "",
          tn("signoff", { names: event.coupleNames }),
        ].join("\n");
    return applySiteTags(core, { siteUrl: website || null, registryUrl: registry || null });
  }, [message, recipients.sampleNames, event, tn, tc, website, registry]);

  const runAction = useCallback(
    async (fn: () => Promise<{ success: boolean; error?: string; data?: BroadcastProgress }>, okMsg: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setBusy(true);
      try {
        const res = await fn();
        if (res.success) {
          if (res.data) setProgress(res.data);
          toast.success(okMsg);
        } else {
          toast.error(tc("common.errorGeneric"), res.error);
        }
      } finally {
        setBusy(false);
        sendingRef.current = false;
      }
    },
    [toast, tc],
  );

  const handleStart = useCallback(() => {
    if (!window.confirm(t("broadcast.confirmStart", { count: recipients.eligible }))) return;
    void runAction(() => startSaveTheDateBroadcast(skipAlreadySent), t("toasts.broadcastStarted"));
  }, [runAction, t, recipients.eligible, skipAlreadySent]);

  const handleResend = useCallback(() => {
    if (!progress) return;
    void runAction(() => resendFailedSaveTheDate(progress.id), t("toasts.resendStarted"));
  }, [runAction, t, progress]);

  const handleCancel = useCallback(() => {
    if (!progress) return;
    if (!window.confirm(t("broadcast.confirmCancel"))) return;
    void runAction(async () => {
      const res = await cancelSaveTheDateBroadcast(progress.id);
      const next = await getSaveTheDateBroadcastProgress(progress.id);
      if (next) setProgress(next);
      return res.success ? { success: true as const } : { success: false as const, error: res.error };
    }, t("toasts.broadcastCancelled"));
  }, [runAction, t, progress]);

  const loadDetail = useCallback(async () => {
    if (!progress) return;
    setDetailLoading(true);
    try {
      const rows = await getSaveTheDateBroadcastRecipients(progress.id);
      setDetail(rows ?? []);
    } finally {
      setDetailLoading(false);
    }
  }, [progress]);

  const exportCsv = useCallback(() => {
    if (!detail) return;
    const header = ["nome", "integrantes", "canal", "status", "erro", "enviado_em"];
    const lines = [header.join(",")];
    for (const r of detail) {
      lines.push(
        [r.name, r.memberNames, r.channelUsed ?? "", r.status, r.error ?? "", r.sentAt ?? ""]
          .map((c) => csvCell(String(c)))
          .join(","),
      );
    }
    const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "save-the-date-envio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [detail]);

  const isSending = progress?.status === "SENDING";
  const processed = progress ? progress.sent + progress.failed + progress.skipped : 0;
  const pct = progress && progress.total > 0 ? Math.round((processed / Math.max(progress.total, 1)) * 100) : 0;

  const channelLabel = (c: string) =>
    c === "WHATSAPP" ? t("preList.channelWhatsapp") : c === "EMAIL" ? t("preList.channelEmail") : "—";
  const rowStatusLabel = (r: RecipientPreviewRow) =>
    r.status === "PENDING" ? t("preList.willReceive") : t(`preList.reason.${r.skipReason ?? "SKIPPED"}`);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Coluna esquerda: configuração */}
      <div className="space-y-6">
        {!event.configured && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p>{t("notConfigured.body")}</p>
              <Link href="/dashboard/onboarding" className="mt-1 inline-block font-medium underline">
                {t("notConfigured.cta")}
              </Link>
            </div>
          </div>
        )}

        <form action={configAction} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">{t("config.title")}</h2>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <ImageIcon className="h-4 w-4" /> {t("config.artLabel")}
            </label>
            {config.hasArt && (
              <div className="mb-2 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                {config.artIsImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/api/save-the-date/art" alt="Save the Date" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <FileText className="h-10 w-10 text-rose-400" />
                )}
                <span className="truncate text-sm text-zinc-300">{config.artName}</span>
              </div>
            )}
            <input
              type="file"
              name="art"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:text-white hover:file:bg-rose-500"
            />
            <p className="mt-1 text-xs text-zinc-500">{t("config.artHint")}</p>
            {config.hasArt && (
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" name="removeArt" className="rounded border-zinc-700 bg-zinc-950" />
                {t("config.removeArt")}
              </label>
            )}
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <Globe className="h-4 w-4" /> {t("config.websiteLabel")}
            </label>
            <input
              type="url"
              name="weddingWebsiteUrl"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <Gift className="h-4 w-4" /> {t("config.registryLabel")}
            </label>
            <input
              type="url"
              name="giftRegistryUrl"
              value={registry}
              onChange={(e) => setRegistry(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">{t("config.messageLabel")}</label>
              <span className="text-xs text-zinc-500">{message.length}/2000</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {MERGE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
            <textarea
              ref={messageRef}
              name="saveTheDateMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              maxLength={2000}
              placeholder={t("config.messagePlaceholder")}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-zinc-500">{t("config.mergeTagsHint")}</p>
          </div>

          {/* Exclusão por tag / padrinhos */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <Tags className="h-4 w-4" /> {t("config.excludeLabel")}
            </label>
            <p className="mb-2 text-xs text-zinc-500">{t("config.excludeHint")}</p>
            <label className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="excludePadrinhos"
                defaultChecked={config.excludePadrinhos}
                className="rounded border-zinc-700 bg-zinc-950"
              />
              {t("config.excludePadrinhos")}
            </label>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      name="excludeTagIds"
                      value={tag.id}
                      defaultChecked={config.excludeTagIds.includes(tag.id)}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">{t("config.noTags")}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={configPending}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {configPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t("config.save")}
          </button>
        </form>

        {/* Envio de teste (próprio ou outro contato) */}
        <form action={testAction} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">{t("test.title")}</h2>
          <p className="text-sm text-zinc-400">{t("test.subtitle")}</p>
          <input name="to" placeholder={t("test.toPlaceholder")} className={inputClass} />
          <p className="text-xs text-zinc-500">{t("test.toHint")}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="channel"
              value="WHATSAPP"
              disabled={testPending || !capabilities.whatsappConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" /> {t("test.whatsapp")}
            </button>
            <button
              type="submit"
              name="channel"
              value="EMAIL"
              disabled={testPending}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-40"
            >
              <Mail className="h-4 w-4" /> {t("test.email")}
            </button>
          </div>
          {!capabilities.whatsappConnected && (
            <p className="text-xs text-amber-300/80">{t("test.whatsappOffline")}</p>
          )}
        </form>
      </div>

      {/* Coluna direita: preview + pré-lista + envio */}
      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">{t("preview.title")}</h2>
          <div className="rounded-2xl bg-[#0b141a] p-4">
            <div className="ml-auto max-w-sm rounded-xl rounded-tr-sm bg-[#005c4b] p-3 text-sm text-zinc-50 shadow">
              {config.hasArt && (
                <div className="mb-2 overflow-hidden rounded-lg">
                  {config.artIsImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/api/save-the-date/art" alt="Save the Date" className="w-full object-cover" />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-black/30 p-3">
                      <FileText className="h-8 w-8" />
                      <span className="truncate text-xs">{config.artName}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap break-words">{previewBody.text}</p>
              {website && !previewBody.usedSite && (
                <p className="mt-2 break-words">
                  • {tn("websiteLabel")}: <span className="underline">{website}</span>
                </p>
              )}
              {registry && !previewBody.usedRegistry && (
                <p className="break-words">
                  • {tn("registryLabel")}: <span className="underline">{registry}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pré-lista de quem vai receber */}
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-rose-400" />
            <h2 className="text-lg font-semibold text-white">{t("preList.title")}</h2>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex-1 rounded-xl bg-zinc-950 p-3 text-center">
              <div className="text-2xl font-bold text-white">{recipients.eligible}</div>
              <div className="text-xs text-zinc-500">{t("broadcast.eligible")}</div>
            </div>
            <div className="flex-1 rounded-xl bg-zinc-950 p-3 text-center">
              <div className="text-2xl font-bold text-zinc-400">{recipients.skipped}</div>
              <div className="text-xs text-zinc-500">{t("broadcast.skipped")}</div>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{t("preList.colName")}</th>
                  <th className="px-3 py-2">{t("preList.colChannel")}</th>
                  <th className="px-3 py-2">{t("preList.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {recipients.list.map((r) => (
                  <tr key={`${r.refType}:${r.refId}`} className="border-t border-zinc-800/70">
                    <td className="px-3 py-2 text-zinc-300">
                      <div className="font-medium text-zinc-200">{r.name}</div>
                      {r.memberNames !== r.name && (
                        <div className="text-zinc-500">{r.memberNames}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{channelLabel(r.channel)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "PENDING" ? "text-emerald-400" : "text-zinc-500"
                        }
                      >
                        {rowStatusLabel(r)}
                      </span>
                    </td>
                  </tr>
                ))}
                {recipients.list.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-zinc-600">
                      {t("preList.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Envio em massa */}
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">{t("broadcast.title")}</h2>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={skipAlreadySent}
              onChange={(e) => setSkipAlreadySent(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950"
            />
            {t("broadcast.skipAlreadySent")}
          </label>

          {progress && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>{t("broadcast.statusLabel")}: {t(`broadcast.status.${progress.status}`)}</span>
                <span className="text-emerald-400">{t("broadcast.sent")}: {progress.sent}</span>
                <span className="text-rose-400">{t("broadcast.failed")}: {progress.failed}</span>
                <span>{t("broadcast.pending")}: {progress.pending}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={busy || isSending || recipients.eligible === 0 || !event.configured}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy || isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("broadcast.start")}
            </button>
            {progress && progress.failed > 0 && (
              <button
                type="button"
                onClick={handleResend}
                disabled={busy || isSending}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("broadcast.resendFailed")}
              </button>
            )}
            {isSending && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-700/50 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
              >
                {t("broadcast.cancel")}
              </button>
            )}
            {progress && (
              <button
                type="button"
                onClick={loadDetail}
                disabled={detailLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {detailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                {t("broadcast.viewList")}
              </button>
            )}
          </div>
          {progress && progress.status === "DONE" && (
            <p className="text-sm text-emerald-400">{t("broadcast.doneNote")}</p>
          )}

          {detail && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{t("broadcast.detailTitle")}</span>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={detail.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> {t("broadcast.exportCsv")}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">{t("preList.colName")}</th>
                      <th className="px-3 py-2">{t("preList.colChannel")}</th>
                      <th className="px-3 py-2">{t("preList.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-800/70">
                        <td className="px-3 py-2 text-zinc-300">{r.name}</td>
                        <td className="px-3 py-2 text-zinc-400">{r.channelUsed ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {r.status}
                          {r.error ? <span className="text-rose-400"> · {r.error}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
