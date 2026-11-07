"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Copy, Loader2, Save, Send, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  deleteAnnouncementDraft,
  duplicateAnnouncement,
  saveAnnouncementDraft,
  sendTestAnnouncement,
  startAnnouncement,
} from "@/app/actions/announcementActions";
import {
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  type Audience,
  type AnnouncementChannel,
  type AnnouncementDraftInput,
} from "@/lib/notifications/announcement-config";
import {
  ANNOUNCEMENT_TAGS,
  announcementUsesTag,
  findUnknownAnnouncementTags,
  formatAnnouncementDate,
  renderAnnouncementText,
} from "@/lib/notifications/announcement-message";
import {
  buildAnnouncementRecipients,
  type AnnouncementSourceGroup,
  type AnnouncementSourceGuest,
} from "@/lib/notifications/announcement-recipients";
import { AudienceFilters, type EditorTag } from "./audience-filters";
import { RecipientPrelist } from "./recipient-prelist";
import { WaPreview, type PreviewArt } from "./wa-preview";

export type EditorInitial = Omit<AnnouncementDraftInput, "excludedRefs"> & {
  excludedRefs: string[];
  art: { name: string; isImage: boolean } | null;
};

export type EditorPreviewContext = {
  configured: boolean;
  coupleNames: string;
  eventDateIso: string | null;
  venueName: string | null;
  siteUrl: string | null;
  registryUrl: string | null;
  sampleRsvpLink: string;
};

type Props = {
  id: string;
  initial: EditorInitial;
  sources: { groups: AnnouncementSourceGroup[]; guests: AnnouncementSourceGuest[] };
  tags: EditorTag[];
  preview: EditorPreviewContext;
  defaultLocale: string;
  capabilities: {
    canManage: boolean;
    whatsappConnected: boolean;
    emailConfigured: boolean;
    hasUserPhone: boolean;
    hasUserEmail: boolean;
  };
};

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50";
const card = "space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl";

function draftOf(s: {
  title: string;
  message: string;
  channel: AnnouncementChannel;
  audience: Audience;
  excluded: Set<string>;
}): AnnouncementDraftInput {
  return {
    title: s.title,
    message: s.message,
    channel: s.channel,
    audience: s.audience,
    excludedRefs: [...s.excluded].sort(),
  };
}

export function AnnouncementEditor({ id, initial, sources, tags, preview, defaultLocale, capabilities }: Props) {
  const t = useTranslations("dashboard.announcements.editor");
  const tTags = useTranslations("dashboard.announcements.tags");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(initial.title);
  const [message, setMessage] = useState(initial.message);
  const [channel, setChannel] = useState<AnnouncementChannel>(initial.channel);
  const [audience, setAudience] = useState<Audience>(initial.audience);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(initial.excludedRefs));
  const [art, setArt] = useState(initial.art);
  const [artVersion, setArtVersion] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [removeArt, setRemoveArt] = useState(false);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(draftOf({ ...initial, excluded: new Set(initial.excludedRefs) })),
  );
  const [busy, setBusy] = useState<null | "save" | "test" | "send" | "delete" | "duplicate">(null);
  const [confirm, setConfirm] = useState<null | "send" | "delete">(null);
  const [testTo, setTestTo] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = useMemo(
    () => JSON.stringify(draftOf({ title, message, channel, audience, excluded })),
    [title, message, channel, audience, excluded],
  );
  const dirty = current !== saved || pendingFile !== null || removeArt;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const pendingUrlRef = useRef<string | null>(null);
  const selectFile = useCallback((file: File | null) => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = file ? URL.createObjectURL(file) : null;
    setPendingFile(file);
    setPendingUrl(pendingUrlRef.current);
  }, []);
  useEffect(
    () => () => {
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    [],
  );

  const { rows, summary } = useMemo(
    () =>
      buildAnnouncementRecipients({
        ...sources,
        audience,
        channel,
        excludedRefs: excluded,
        requirePin: announcementUsesTag(message, "pin"),
        defaultLocale,
      }),
    [sources, audience, channel, excluded, message, defaultLocale],
  );

  const unknownTags = useMemo(() => findUnknownAnnouncementTags(message), [message]);

  const previewText = useMemo(() => {
    const sample = rows.find((r) => r.status === "PENDING");
    const recipientLocale = sample?.locale ?? defaultLocale;
    return renderAnnouncementText(message, {
      nomes: preview.coupleNames,
      convidados: sample?.memberNames ?? t("preview.sampleGuests"),
      data: formatAnnouncementDate(preview.eventDateIso, recipientLocale),
      local: preview.venueName ?? "",
      site: preview.siteUrl ?? "",
      "site-presentes": preview.registryUrl ?? "",
      "link-rsvp": preview.sampleRsvpLink,
      pin: "1234",
    }).trim();
  }, [message, rows, preview, defaultLocale, t]);

  const previewArt: PreviewArt | null = pendingFile
    ? { src: pendingUrl, name: pendingFile.name, isImage: pendingFile.type.startsWith("image/") }
    : art && !removeArt
      ? { src: `/api/announcements/${id}/art?v=${artVersion}`, name: art.name, isImage: art.isImage }
      : null;

  const insertTag = useCallback(
    (tag: string) => {
      const token = `{${tag}}`;
      const el = messageRef.current;
      const start = el?.selectionStart ?? message.length;
      const end = el?.selectionEnd ?? message.length;
      const next = (message.slice(0, start) + token + message.slice(end)).slice(0, ANNOUNCEMENT_MESSAGE_MAX);
      setMessage(next);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + token.length;
        el?.setSelectionRange(pos, pos);
      });
    },
    [message],
  );

  const toggleExcluded = useCallback((key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setMany = useCallback((keys: string[], include: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (include) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("payload", current);
    if (pendingFile) fd.append("art", pendingFile);
    else if (removeArt) fd.append("removeArt", "true");
    const res = await saveAnnouncementDraft(undefined, fd);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return false;
    }
    const savedArt = res.data?.art ?? null;
    setArt(savedArt ? { name: savedArt.name, isImage: savedArt.mime.startsWith("image/") } : null);
    setArtVersion((v) => v + 1);
    selectFile(null);
    setRemoveArt(false);
    if (fileRef.current) fileRef.current.value = "";
    setSaved(current);
    return true;
  }, [id, current, pendingFile, removeArt, toast, tc, selectFile]);

  const run = useCallback(
    async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(kind);
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  const handleSave = () =>
    run("save", async () => {
      if (await save()) toast.success(t("toasts.saved"));
    });

  const handleTest = (testChannel: "WHATSAPP" | "EMAIL") =>
    run("test", async () => {
      if (dirty && !(await save())) return;
      const fd = new FormData();
      fd.append("id", id);
      fd.append("channel", testChannel);
      fd.append("to", testTo);
      const res = await sendTestAnnouncement(undefined, fd);
      if (res.success) toast.success(t("toasts.testSent"));
      else toast.error(tc("common.errorGeneric"), res.error);
    });

  const handleSend = () =>
    run("send", async () => {
      if (dirty && !(await save())) return;
      const res = await startAnnouncement(id);
      setConfirm(null);
      if (!res.success) {
        toast.error(tc("common.errorGeneric"), res.error);
        return;
      }
      toast.success(t("toasts.started"));
      router.refresh();
    });

  const handleDelete = () =>
    run("delete", async () => {
      const res = await deleteAnnouncementDraft(id);
      setConfirm(null);
      if (!res.success) {
        toast.error(tc("common.errorGeneric"), res.error);
        return;
      }
      setSaved(current);
      selectFile(null);
      setRemoveArt(false);
      toast.success(t("toasts.deleted"));
      router.push("/dashboard/communications/announcements");
    });

  const handleDuplicate = () =>
    run("duplicate", async () => {
      if (dirty && !(await save())) return;
      const res = await duplicateAnnouncement(id);
      if (!res.success || !res.data) {
        toast.error(tc("common.errorGeneric"), res.success ? undefined : res.error);
        return;
      }
      toast.success(t("toasts.duplicated"));
      router.push(`/dashboard/communications/announcements/${res.data.id}`);
    });

  const channelUnavailable =
    (channel === "WHATSAPP" && !capabilities.whatsappConnected) ||
    (channel === "EMAIL" && !capabilities.emailConfigured) ||
    (channel === "AUTO" && !capabilities.whatsappConnected && !capabilities.emailConfigured);
  const canSend =
    capabilities.canManage && preview.configured && message.trim().length > 0 && summary.pending > 0 && !busy;

  return (
    <div className="space-y-6">
      {!preview.configured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("notConfigured")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="text-lg font-semibold text-white">{t("compose.title")}</h2>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-300">{t("compose.subjectLabel")}</span>
              <input
                value={title}
                maxLength={ANNOUNCEMENT_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value.replace(/[\r\n]/g, ""))}
                className={inputClass}
              />
              <span className="text-xs text-zinc-500">{t("compose.subjectHint")}</span>
            </label>

            <div className="space-y-1">
              <label htmlFor="announcement-message" className="text-sm text-zinc-300">
                {t("compose.messageLabel")}
              </label>
              <textarea
                id="announcement-message"
                ref={messageRef}
                rows={9}
                value={message}
                maxLength={ANNOUNCEMENT_MESSAGE_MAX}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("compose.messagePlaceholder", { tag: "{convidados}" })}
                className={inputClass}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{t("compose.tagsOptional")}</span>
                <span>
                  {message.length}/{ANNOUNCEMENT_MESSAGE_MAX}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  title={tTags(`${tag}.hint`)}
                  className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-rose-500/50 hover:text-rose-200"
                >
                  {`{${tag}}`}
                </button>
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-zinc-500 sm:grid-cols-2">
              {ANNOUNCEMENT_TAGS.map((tag) => (
                <li key={tag}>
                  <span className="font-mono text-zinc-400">{`{${tag}}`}</span> — {tTags(`${tag}.hint`)}
                </li>
              ))}
            </ul>

            {unknownTags.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("compose.unknownTags", { tags: unknownTags.map((x) => `{${x}}`).join(", ") })}
              </p>
            )}

            <div className="space-y-2">
              <span className="text-sm text-zinc-300">{t("compose.artLabel")}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => {
                  selectFile(e.target.files?.[0] ?? null);
                  setRemoveArt(false);
                }}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
              />
              {(art || pendingFile) && (
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={removeArt}
                    onChange={(e) => {
                      setRemoveArt(e.target.checked);
                      if (e.target.checked) {
                        selectFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }
                    }}
                    className="rounded border-zinc-700 bg-zinc-950"
                  />
                  {t("compose.removeArt")}
                </label>
              )}
              <p className="text-xs text-zinc-500">{t("compose.artHint")}</p>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-white">{t("channel.title")}</h2>
            <div className="space-y-2">
              {ANNOUNCEMENT_CHANNELS.map((c) => (
                <label
                  key={c}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                    channel === c ? "border-rose-500/50 bg-rose-500/5" : "border-zinc-800 bg-zinc-950"
                  }`}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-zinc-200">{t(`channel.${c}.label`)}</span>
                    <span className="block text-xs text-zinc-500">{t(`channel.${c}.hint`)}</span>
                  </span>
                </label>
              ))}
            </div>
            {channelUnavailable && (
              <p className="text-xs text-amber-300/80">{t("channel.unavailable")}</p>
            )}
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-white">{t("audienceTitle")}</h2>
            <AudienceFilters audience={audience} tags={tags} onChange={setAudience} />
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="text-lg font-semibold text-white">{t("preview.title")}</h2>
            <WaPreview text={previewText} art={previewArt} emptyLabel={t("preview.empty")} />
            <p className="text-xs text-zinc-500">{t("preview.hint")}</p>
          </section>

          <RecipientPrelist
            rows={rows}
            summary={summary}
            excluded={excluded}
            onToggle={toggleExcluded}
            onSetMany={setMany}
          />

          <section className={card}>
            <h2 className="text-lg font-semibold text-white">{t("test.title")}</h2>
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={t("test.toPlaceholder")}
              aria-label={t("test.toPlaceholder")}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy) || !capabilities.whatsappConnected || (!testTo && !capabilities.hasUserPhone)}
                onClick={() => handleTest("WHATSAPP")}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("test.whatsapp")}
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !capabilities.emailConfigured || (!testTo && !capabilities.hasUserEmail)}
                onClick={() => handleTest("EMAIL")}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("test.email")}
              </button>
            </div>
            <p className="text-xs text-zinc-500">{t("test.hint")}</p>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        <span className="mr-auto text-xs text-zinc-500">{dirty ? t("unsaved") : t("allSaved")}</span>
        <button
          type="button"
          onClick={() => setConfirm("delete")}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("actions.delete")}
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          {t("actions.duplicate")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={Boolean(busy) || !dirty || title.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("actions.save")}
        </button>
        {capabilities.canManage ? (
          <button
            type="button"
            onClick={() => setConfirm("send")}
            disabled={!canSend || channelUnavailable}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {t("actions.send", { count: summary.pending })}
          </button>
        ) : (
          <span className="text-xs text-zinc-500">{t("actions.sendNeedsManager")}</span>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "send"}
        title={t("confirmSend.title")}
        description={[
          t("confirmSend.summary", { messages: summary.pending, guests: summary.guestsReached }),
          t("confirmSend.channel", { channel: t(`channel.${channel}.label`) }),
          summary.skipped > 0 ? t("confirmSend.skipped", { count: summary.skipped }) : null,
          previewArt ? t("confirmSend.withArt") : null,
          unknownTags.length > 0
            ? t("compose.unknownTags", { tags: unknownTags.map((x) => `{${x}}`).join(", ") })
            : null,
          t("confirmSend.irreversible"),
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={t("confirmSend.confirm")}
        cancelLabel={tc("actions.cancel")}
        busy={busy === "send"}
        onConfirm={handleSend}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        tone="danger"
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={tc("actions.cancel")}
        busy={busy === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
