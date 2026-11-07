"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Send,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  RefreshCw,
  Ban,
  Mail,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  saveInvitationConfig,
  sendTestInvitation,
  startInvitationBroadcast,
  resendFailedInvitations,
  cancelInvitationBroadcast,
  getInvitationBroadcastProgress,
  getInvitationBroadcastRecipients,
  exportInvitationBroadcastCsv,
  type RecipientPreviewRow,
  type BroadcastProgress,
  type BroadcastRecipientRow,
} from "@/app/actions/invitationActions";

type InvitationsClientProps = {
  config: {
    invitationMessage: string;
    invitationRsvpUseExternal: boolean;
    invitationRsvpUrl: string;
    invitationRsvpDeadline: string;
    hasArt: boolean;
    artName: string | null;
    artIsImage: boolean;
    excludeTagIds: string[];
    excludePadrinhos: boolean;
  };
  tags: Array<{ id: string; name: string; color: string | null }>;
  event: {
    coupleNames: string;
    eventDate: string | null;
    daySchedule: string | null;
    configured: boolean;
  };
  recipients: {
    readyCount: number;
    noPinCount: number;
    skippedCount: number;
    list: RecipientPreviewRow[];
  };
  capabilities: {
    canManage: boolean;
    whatsappConnected: boolean;
    hasUserPhone: boolean;
    hasUserEmail: boolean;
  };
  activeBroadcast: BroadcastProgress | null;
};

export default function InvitationsClient({
  config,
  tags,
  event,
  recipients,
  capabilities,
  activeBroadcast,
}: InvitationsClientProps) {
  const t = useTranslations("dashboard.invitations");

  const [activeTab, setActiveTab] = useState<"config" | "recipients" | "broadcast">(
    activeBroadcast && activeBroadcast.status === "SENDING" ? "broadcast" : "config",
  );

  // Form State
  const [message, setMessage] = useState(config.invitationMessage);
  const [useExternal, setUseExternal] = useState(config.invitationRsvpUseExternal);
  const [externalUrl, setExternalUrl] = useState(config.invitationRsvpUrl);
  const [deadline, setDeadline] = useState(config.invitationRsvpDeadline);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>(config.excludeTagIds);
  const [excludePadrinhos, setExcludePadrinhos] = useState(config.excludePadrinhos);
  const [removeArt, setRemoveArt] = useState(false);
  const [selectedArtFile, setSelectedArtFile] = useState<File | null>(null);

  // Status & Feedback
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; error?: string } | null>(null);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; error?: string } | null>(null);
  const [broadcastStatusAlert, setBroadcastStatusAlert] = useState<{ success?: boolean; error?: string } | null>(null);

  // Test send state
  const [testChannel, setTestChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [testTo, setTestTo] = useState("");

  // Recipient list filtering
  const [recFilter, setRecFilter] = useState<"ALL" | "READY" | "NO_PIN" | "SKIPPED">("ALL");
  const [recSearch, setRecSearch] = useState("");

  // Broadcast state
  const [progress, setProgress] = useState<BroadcastProgress | null>(activeBroadcast);
  const [broadcastRecipients, setBroadcastRecipients] = useState<BroadcastRecipientRow[] | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [unknownCount, setUnknownCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  // Cursor insertion helper for merge tags
  const insertMergeTag = (tagText: string) => {
    if (!textareaRef.current) {
      setMessage((prev) => prev + `{${tagText}}`);
      return;
    }
    const elem = textareaRef.current;
    const start = elem.selectionStart;
    const end = elem.selectionEnd;
    const inserted = `{${tagText}}`;
    const newMsg = message.substring(0, start) + inserted + message.substring(end);
    setMessage(newMsg);

    setTimeout(() => {
      elem.focus();
      elem.setSelectionRange(start + inserted.length, start + inserted.length);
    }, 0);
  };

  // Poll broadcast progress when SENDING
  useEffect(() => {
    if (!progress || progress.status !== "SENDING") return;
    const interval = setInterval(async () => {
      const updated = await getInvitationBroadcastProgress(progress.id);
      if (updated) {
        setProgress(updated);
        if (updated.status !== "SENDING") {
          const recs = await getInvitationBroadcastRecipients(updated.id);
          setBroadcastRecipients(recs);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [progress]);

  // Load broadcast recipients when a broadcast is active
  useEffect(() => {
    if (progress?.id && !broadcastRecipients) {
      getInvitationBroadcastRecipients(progress.id).then(setBroadcastRecipients);
    }
  }, [progress?.id, broadcastRecipients]);

  // Save config submission
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);

    const fd = new FormData();
    fd.set("invitationMessage", message);
    if (useExternal) fd.set("invitationRsvpUseExternal", "true");
    fd.set("invitationRsvpUrl", externalUrl);
    fd.set("invitationRsvpDeadline", deadline);
    if (removeArt) fd.set("removeArt", "true");
    if (excludePadrinhos) fd.set("excludePadrinhos", "true");
    for (const tagId of excludeTagIds) {
      fd.append("excludeTagIds", tagId);
    }
    if (selectedArtFile) {
      fd.set("art", selectedArtFile);
    }

    startTransition(async () => {
      const res = await saveInvitationConfig(undefined, fd);
      if (res.success) {
        setSaveStatus({ success: true });
        setSelectedArtFile(null);
        setRemoveArt(false);
      } else {
        setSaveStatus({ success: false, error: res.error });
      }
    });
  };

  // Test send submission
  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestStatus(null);

    const fd = new FormData();
    fd.set("channel", testChannel);
    fd.set("to", testTo);

    startTransition(async () => {
      const res = await sendTestInvitation(undefined, fd);
      if (res.success) {
        setTestStatus({ success: true });
      } else {
        setTestStatus({ success: false, error: res.error });
      }
    });
  };

  // Start broadcast
  const handleStartBroadcast = async () => {
    setShowConfirmModal(false);
    setBroadcastStatusAlert(null);

    startTransition(async () => {
      const res = await startInvitationBroadcast(true);
      if (!res.success) {
        setBroadcastStatusAlert({ success: false, error: res.error });
      } else if (res.data) {
        setProgress(res.data);
        setActiveTab("broadcast");
        const recs = await getInvitationBroadcastRecipients(res.data.id);
        setBroadcastRecipients(recs);
      }
    });
  };

  // Resend failed
  const handleResendFailed = async (confirmUnknown = false) => {
    if (!progress) return;
    setShowUnknownModal(false);
    setBroadcastStatusAlert(null);

    startTransition(async () => {
      const res = await resendFailedInvitations(progress.id, confirmUnknown);
      if (!res.success) {
        if (res.error && res.error.includes("desconhecido")) {
          // Unknown count confirmation requested
          const match = res.error.match(/\d+/);
          setUnknownCount(match ? parseInt(match[0], 10) : 1);
          setShowUnknownModal(true);
        } else {
          setBroadcastStatusAlert({ success: false, error: res.error });
        }
      } else if (res.data) {
        setProgress(res.data);
        const recs = await getInvitationBroadcastRecipients(progress.id);
        setBroadcastRecipients(recs);
      }
    });
  };

  // Cancel broadcast
  const handleCancelBroadcast = async () => {
    if (!progress) return;
    setBroadcastStatusAlert(null);

    startTransition(async () => {
      const res = await cancelInvitationBroadcast(progress.id);
      if (res.success) {
        const updated = await getInvitationBroadcastProgress(progress.id);
        if (updated) setProgress(updated);
        const recs = await getInvitationBroadcastRecipients(progress.id);
        setBroadcastRecipients(recs);
      } else {
        setBroadcastStatusAlert({ success: false, error: res.error });
      }
    });
  };

  // Export CSV
  const handleExportCsv = async () => {
    if (!progress) return;
    const res = await exportInvitationBroadcastCsv(progress.id);
    if (res.success && res.data) {
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `convites-oficiais-${progress.id.slice(-6)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Recipient list filtering
  const filteredRecipients = recipients.list.filter((r) => {
    if (recFilter === "READY" && r.status !== "PENDING") return false;
    if (recFilter === "NO_PIN" && r.skipReason !== "NO_PIN") return false;
    if (recFilter === "SKIPPED" && (r.status !== "SKIPPED" || r.skipReason === "NO_PIN")) return false;

    if (recSearch.trim()) {
      const q = recSearch.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.memberNames.toLowerCase().includes(q) ||
        (r.skipReason && r.skipReason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const percentProgress = progress && progress.total > 0
    ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {!event.configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Atenção: Configure a data do evento e os nomes do casal em Ajustes antes de disparar os convites.
        </div>
      )}

      {/* 5 KPI Metric Header Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">{t("metrics.ready")}</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{recipients.readyCount}</p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">{t("metrics.noPin")}</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{recipients.noPinCount}</p>
        </div>

        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">{t("metrics.skipped")}</span>
            <Ban className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{recipients.skippedCount}</p>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-sky-400">{t("metrics.sent")}</span>
            <CheckCircle2 className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{progress ? progress.sent : 0}</p>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">{t("metrics.failed")}</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{progress ? progress.failed : 0}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-2 border-b border-zinc-800 pb-1">
        <button
          onClick={() => setActiveTab("config")}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
            activeTab === "config"
              ? "border-b-2 border-emerald-500 text-white bg-zinc-800/40"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t("tabs.config")}
        </button>
        <button
          onClick={() => setActiveTab("recipients")}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
            activeTab === "recipients"
              ? "border-b-2 border-emerald-500 text-white bg-zinc-800/40"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t("tabs.recipients")} ({recipients.list.length})
        </button>
        <button
          onClick={() => setActiveTab("broadcast")}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors rounded-t-lg flex items-center space-x-2 ${
            activeTab === "broadcast"
              ? "border-b-2 border-emerald-500 text-white bg-zinc-800/40"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>{t("tabs.broadcast")}</span>
          {progress && progress.status === "SENDING" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveConfig} className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white">{t("config.title")}</h2>

              {saveStatus?.success && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  {t("toasts.configSaved")}
                </div>
              )}
              {saveStatus?.error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {saveStatus.error}
                </div>
              )}

              {/* Message Editor */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-200">{t("config.messageLabel")}</label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  disabled={!capabilities.canManage}
                  placeholder={t("config.messagePlaceholder")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />

                {/* Merge Tag Pills */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs text-zinc-400">{t("config.tagsHelp")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => insertMergeTag("pin")}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      {t("tags.pin")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("link-rsvp")}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      {t("tags.linkRsvp")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("data-limite")}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      {t("tags.deadline")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("nomes")}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                    >
                      {t("tags.nomes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("convidados")}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                    >
                      {t("tags.convidados")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("data")}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                    >
                      {t("tags.data")}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMergeTag("local")}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                    >
                      {t("tags.local")}
                    </button>
                  </div>
                </div>
              </div>

              {/* RSVP Mode Selector */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-zinc-200">{t("config.rsvpMode")}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUseExternal(false)}
                    disabled={!capabilities.canManage}
                    className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                      !useExternal
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("config.nativeRsvp")}</p>
                      <p className="text-xs text-zinc-400">PIN Gate + Formulário do sistema</p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${!useExternal ? "border-emerald-500 bg-emerald-500" : "border-zinc-600"}`}>
                      {!useExternal && <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseExternal(true)}
                    disabled={!capabilities.canManage}
                    className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                      useExternal
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("config.externalRsvp")}</p>
                      <p className="text-xs text-zinc-400">Redireciona para URL personalizada</p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${useExternal ? "border-emerald-500 bg-emerald-500" : "border-zinc-600"}`}>
                      {useExternal && <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* External RSVP URL (if external selected) */}
              {useExternal && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-200">{t("config.externalUrlLabel")}</label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    disabled={!capabilities.canManage}
                    placeholder={t("config.externalUrlPlaceholder")}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              )}

              {/* Confirmation Deadline */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-200">{t("config.deadlineLabel")}</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={!capabilities.canManage}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Art Upload & Preview */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-zinc-200">{t("config.artLabel")}</label>
                {config.hasArt && !removeArt && (
                  <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6 text-emerald-400" />
                      <span className="text-sm font-medium text-zinc-200">{config.artName || "Arte do convite"}</span>
                    </div>
                    {capabilities.canManage && (
                      <label className="flex items-center space-x-2 text-xs text-rose-400 cursor-pointer hover:underline">
                        <input
                          type="checkbox"
                          checked={removeArt}
                          onChange={(e) => setRemoveArt(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-800 text-rose-500 focus:ring-rose-500"
                        />
                        <span>{t("config.removeArt")}</span>
                      </label>
                    )}
                  </div>
                )}

                {capabilities.canManage && (
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => setSelectedArtFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-300 hover:file:bg-emerald-500/20"
                    />
                    <p className="mt-1 text-xs text-zinc-400">{t("config.artHint")}</p>
                  </div>
                )}
              </div>

              {/* Exclusions & Tag Filters */}
              <div className="space-y-3 border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold text-zinc-200">{t("config.filtersTitle")}</h3>

                <label className="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludePadrinhos}
                    onChange={(e) => setExcludePadrinhos(e.target.checked)}
                    disabled={!capabilities.canManage}
                    className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>{t("config.excludePadrinhos")}</span>
                </label>

                {tags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-400">{t("config.excludeTags")}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const isChecked = excludeTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (!capabilities.canManage) return;
                              setExcludeTagIds((prev) =>
                                isChecked ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                              );
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              isChecked
                                ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Save */}
              {capabilities.canManage && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-600 font-semibold text-sm text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  >
                    {isPending ? t("config.saving") : t("config.saveButton")}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Test Send Column */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">{t("test.title")}</h3>
              </div>
              <p className="text-xs text-zinc-400">{t("test.subtitle")}</p>

              {testStatus?.success && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  {t("toasts.testSent")}
                </div>
              )}
              {testStatus?.error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {testStatus.error}
                </div>
              )}

              <form onSubmit={handleTestSend} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">Canal</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTestChannel("WHATSAPP")}
                      className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-medium ${
                        testChannel === "WHATSAPP"
                          ? "border-emerald-500 bg-emerald-500/10 text-white"
                          : "border-zinc-800 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestChannel("EMAIL")}
                      className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-medium ${
                        testChannel === "EMAIL"
                          ? "border-emerald-500 bg-emerald-500/10 text-white"
                          : "border-zinc-800 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      <span>E-mail</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Destino do teste</label>
                  <input
                    type="text"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder={t("test.toPlaceholder")}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50"
                >
                  {isPending ? t("test.sending") : testChannel === "WHATSAPP" ? t("test.whatsapp") : t("test.email")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECIPIENTS PREFLIGHT LIST */}
      {activeTab === "recipients" && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">{t("recipients.title")}</h2>
            <input
              type="text"
              value={recSearch}
              onChange={(e) => setRecSearch(e.target.value)}
              placeholder="Buscar convidado ou motivo..."
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRecFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                recFilter === "ALL" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t("recipients.filterAll", { count: recipients.list.length })}
            </button>
            <button
              onClick={() => setRecFilter("READY")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                recFilter === "READY" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t("recipients.filterReady", { count: recipients.readyCount })}
            </button>
            <button
              onClick={() => setRecFilter("NO_PIN")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                recFilter === "NO_PIN" ? "bg-amber-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t("recipients.filterNoPin", { count: recipients.noPinCount })}
            </button>
            <button
              onClick={() => setRecFilter("SKIPPED")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                recFilter === "SKIPPED" ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t("recipients.filterSkipped", { count: recipients.skippedCount })}
            </button>
          </div>

          {/* Preflight Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-medium">{t("recipients.colName")}</th>
                  <th className="py-3 px-4 font-medium">{t("recipients.colMembers")}</th>
                  <th className="py-3 px-4 font-medium">{t("recipients.colChannel")}</th>
                  <th className="py-3 px-4 font-medium">{t("recipients.colPin")}</th>
                  <th className="py-3 px-4 font-medium">{t("recipients.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      {t("recipients.empty")}
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((r, idx) => (
                    <tr key={`${r.refType}-${r.refId}-${idx}`} className="hover:bg-zinc-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">{r.name}</span>
                          <span className="text-[10px] rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                            {r.refType === "GuestGroup" ? "Grupo" : "Individual"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">
                        {r.memberNames}
                      </td>
                      <td className="py-3 px-4">
                        {r.channel === "WHATSAPP" ? (
                          <span className="text-emerald-400 font-medium">WhatsApp</span>
                        ) : r.channel === "EMAIL" ? (
                          <span className="text-sky-400 font-medium">E-mail</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.hasPin ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                            {t("recipients.hasPinYes")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                            {t("recipients.hasPinNo")}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.status === "PENDING" ? (
                          <span className="text-emerald-400 font-medium">Pronto</span>
                        ) : (
                          <span className="text-zinc-400">
                            {r.skipReason && t.has(`reasons.${r.skipReason}`)
                              ? t(`reasons.${r.skipReason}`)
                              : r.skipReason ?? "Ignorado"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BROADCAST & REPORT */}
      {activeTab === "broadcast" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{t("broadcast.title")}</h2>
                {progress && (
                  <p className="text-xs text-zinc-400">
                    Status: <span className="font-semibold text-white">{progress.status}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {capabilities.canManage && (!progress || progress.status === "DONE" || progress.status === "CANCELLED" || progress.status === "FAILED") && (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isPending || recipients.readyCount === 0}
                    className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span>{t("broadcast.start")}</span>
                  </button>
                )}

                {capabilities.canManage && progress && progress.failed > 0 && progress.status !== "SENDING" && (
                  <button
                    onClick={() => handleResendFailed(false)}
                    disabled={isPending}
                    className="flex items-center space-x-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>{t("broadcast.resendFailed")}</span>
                  </button>
                )}

                {capabilities.canManage && progress && progress.status === "SENDING" && (
                  <button
                    onClick={handleCancelBroadcast}
                    disabled={isPending}
                    className="flex items-center space-x-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    <span>{t("broadcast.cancel")}</span>
                  </button>
                )}

                {progress && (
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center space-x-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                    <span>{t("broadcast.exportCsv")}</span>
                  </button>
                )}
              </div>
            </div>

            {broadcastStatusAlert?.error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                {broadcastStatusAlert.error}
              </div>
            )}

            {/* Progress Bar */}
            {progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-zinc-400">
                  <span>{t("broadcast.progress")}</span>
                  <span>{percentProgress}% ({progress.sent + progress.failed + progress.skipped} / {progress.total})</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={percentProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 w-full overflow-hidden rounded-full bg-zinc-800"
                >
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
                    style={{ width: `${percentProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Broadcast Recipient Results Table */}
            {broadcastRecipients && broadcastRecipients.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-white">Relatório por Destinatário</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Nome</th>
                        <th className="py-2.5 px-3 font-medium">Integrantes</th>
                        <th className="py-2.5 px-3 font-medium">Canal</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                        <th className="py-2.5 px-3 font-medium">Motivo/Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {broadcastRecipients.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-800/30">
                          <td className="py-2.5 px-3 font-medium text-white">{r.name}</td>
                          <td className="py-2.5 px-3 text-zinc-400">{r.memberNames}</td>
                          <td className="py-2.5 px-3">{r.channelUsed ?? "—"}</td>
                          <td className="py-2.5 px-3">
                            {r.status === "SENT" ? (
                              <span className="text-emerald-400 font-semibold">Enviado</span>
                            ) : r.status === "FAILED" ? (
                              <span className="text-rose-400 font-semibold">Falhou</span>
                            ) : r.status === "SKIPPED" ? (
                              <span className="text-zinc-400">Ignorado</span>
                            ) : (
                              <span className="text-sky-400 font-semibold">Na fila</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">{r.error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE BROADCAST START */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t("broadcast.confirmModalTitle")}</h3>
            </div>

            <p className="text-xs text-zinc-300">{t("broadcast.confirmModalIntro")}</p>

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-300">
              <p>• {t("broadcast.modalEligible", { count: recipients.readyCount })}</p>
              <p className="text-amber-400">• {t("broadcast.modalNoPin", { count: recipients.noPinCount })}</p>
              <p>• {t("broadcast.modalSkipped", { count: recipients.skippedCount })}</p>
              <p>• {t("broadcast.modalMode", { mode: useExternal ? "RSVP Externo" : "RSVP Nativo" })}</p>
              <p>• {t("broadcast.modalDeadline", { deadline: deadline || "Não definido" })}</p>
              <p>• {t("broadcast.modalArt", { art: config.hasArt ? "Sim" : "Não" })}</p>
            </div>

            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-semibold">
              {t("broadcast.modalWarning")}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartBroadcast}
                disabled={isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {t("broadcast.confirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR UNKNOWN DELIVERY STATE RESEND */}
      {showUnknownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">{t("broadcast.confirmUnknownTitle")}</h3>
            </div>

            <p className="text-xs text-zinc-300">
              {t("broadcast.confirmUnknownMessage", { count: unknownCount })}
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUnknownModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleResendFailed(true)}
                disabled={isPending}
                className="px-5 py-2 rounded-lg bg-amber-600 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {t("broadcast.confirmUnknownSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
