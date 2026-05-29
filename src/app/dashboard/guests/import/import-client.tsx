"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast";
import {
  commitGuestImport,
  previewGuestImport,
  type CommitData,
  type CommitMode,
  type PreviewData,
} from "@/app/actions/guestActions";
import { IMPORTER_OPTIONS } from "@/lib/guest-importers";
import { PreviewTable } from "./_components/preview-table";
import { PasteImportModal } from "./_components/paste-modal";

const MODE_OPTION_IDS: CommitMode[] = [
  "CREATE_NEW_ONLY",
  "UPSERT_BY_NAME",
  "CREATE_ALL_DUPLICATES",
];

type Step = "upload" | "preview" | "done";

export function GuestImportClient() {
  const router = useRouter();
  const t = useTranslations("dashboard.guests.import");
  const tc = useTranslations("common");
  const b = (chunks: React.ReactNode) => <strong className="text-zinc-100">{chunks}</strong>;
  const toast = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [source, setSource] = useState<string>("AUTO");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mode, setMode] = useState<CommitMode>("CREATE_NEW_ONLY");
  const [filter, setFilter] = useState<
    "all" | "new" | "duplicate_same" | "duplicate_diff"
  >("all");
  const [result, setResult] = useState<CommitData | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [, startTransition] = useTransition();

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      toast.error(t("toast.selectFile"));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("source", source);
      const r = await previewGuestImport(undefined, fd);
      if (!r.success) {
        toast.error(tc("common.errorGeneric"), r.error);
        return;
      }
      if (!r.data) {
        toast.error(t("toast.unexpectedResponse"));
        return;
      }
      setPreview(r.data);
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setPreview(null);
    setFile(null);
    setStep("upload");
  }

  async function handleConfirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await commitGuestImport({
        importToken: preview.importToken,
        mode,
      });
      if (!r.success) {
        toast.error(t("toast.importFailed"), r.error);
        return;
      }
      if (!r.data) {
        toast.error(t("toast.unexpectedResponse"));
        return;
      }
      setResult(r.data);
      setStep("done");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/dashboard/guests"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> {t("backToGuests")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100 md:text-2xl">
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-400">
          {t("subtitle", { sources: IMPORTER_OPTIONS.map((o) => o.label).join(", ") })}
        </p>
      </div>

      {step === "upload" ? (
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              {t("upload.fileLabel")}
            </label>
            <input
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-500/20 file:px-3 file:py-1.5 file:text-rose-200 hover:file:bg-rose-500/30"
            />
            <p className="mt-1 text-xs text-zinc-500">{t("upload.fileHint")}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("upload.sourceLabel")}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="AUTO">{t("upload.autoDetect")}</option>
              {IMPORTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPaste(true)}
              className="text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              {t("upload.preferPaste")}
            </button>
            <button
              type="submit"
              disabled={busy || !file}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("upload.analyze")}
            </button>
          </div>
        </form>
      ) : null}

      {step === "preview" && preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatTile label={t("preview.rowsInFile")} value={preview.totalRows} accent="rose" />
            <StatTile label={t("preview.new")} value={preview.breakdown.new} accent="emerald" />
            <StatTile
              label={t("preview.existingSameGroup")}
              value={preview.breakdown.duplicateSame}
              accent="zinc"
            />
            <StatTile
              label={t("preview.divergent")}
              value={preview.breakdown.duplicateDiff}
              accent="amber"
            />
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-semibold text-zinc-100">{t("preview.detectedSource")}</h2>
            <p className="text-sm text-zinc-400">
              {preview.sourceLabel} —{" "}
              <span className="text-zinc-500">{t("preview.fileValid")}</span>
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">
              {t("preview.detectedGroups", { count: preview.groupsPreview.length })}
            </h2>
            {preview.groupsPreview.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("preview.noGroups")}</p>
            ) : (
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {preview.groupsPreview.map((g) => (
                  <li
                    key={g.name}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                  >
                    <span>{g.name}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-500">{t("preview.peopleCount", { count: g.count })}</span>
                    {g.pin ? (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-rose-300">{t("preview.pin", { pin: g.pin })}</span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">
              {t("preview.detectedTags", { count: preview.tagsPreview.length })}
            </h2>
            {preview.tagsPreview.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("preview.noTags")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {preview.tagsPreview.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs text-rose-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">{t("preview.tagsNote")}</p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">
                {t("preview.sampleTitle", { count: preview.sample.length })}
              </h2>
              <div className="flex gap-1 text-xs">
                {([
                  ["all", t("preview.filterAll")],
                  ["new", t("preview.filterNew")],
                  ["duplicate_same", t("preview.filterExisting")],
                  ["duplicate_diff", t("preview.filterDivergent")],
                ] as const).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`rounded-lg px-2 py-1 ${
                      filter === id
                        ? "bg-rose-500/20 text-rose-200"
                        : "text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <PreviewTable rows={preview.sample} filter={filter} />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-100">
              {t("mode.heading")}
            </h2>
            <div className="space-y-2">
              {MODE_OPTION_IDS.map((id) => (
                <label
                  key={id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                    mode === id
                      ? "border-rose-500/40 bg-rose-500/5"
                      : "border-zinc-800 hover:bg-zinc-900"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={id}
                    checked={mode === id}
                    onChange={() => setMode(id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{t(`mode.${id}.label`)}</div>
                    <div className="text-xs text-zinc-500">{t(`mode.${id}.description`)}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <X className="h-4 w-4" /> {tc("actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {t("preview.confirmImport")}
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-base font-semibold">{t("done.title")}</h2>
          </div>
          <ul className="text-sm text-zinc-300">
            <li>
              {t.rich("done.created", { count: result.created, b })}
            </li>
            <li>
              {t.rich("done.updated", { count: result.updated, b })}
            </li>
            <li>
              {t.rich("done.skipped", { count: result.skipped, b })}
            </li>
            <li>
              {t.rich("done.groupsCreated", { count: result.groupsCreated, b })}
            </li>
            <li>
              {t.rich("done.tagsCreated", { count: result.tagsCreated, b })}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/guests"
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              {t("done.viewList")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPreview(null);
                setFile(null);
                setStep("upload");
              }}
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {t("done.importAnother")}
            </button>
          </div>
        </div>
      ) : null}

      {showPaste ? <PasteImportModal onClose={() => setShowPaste(false)} /> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "rose" | "emerald" | "amber" | "zinc";
}) {
  const styles: Record<typeof accent, string> = {
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-200",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    zinc: "bg-zinc-800/60 border-zinc-700/50 text-zinc-300",
  };
  return (
    <div className={`rounded-2xl border p-3 ${styles[accent]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}
