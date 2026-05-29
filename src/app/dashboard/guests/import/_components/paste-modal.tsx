"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { bulkImportGuests } from "@/app/actions/guestActions";

export function PasteImportModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("dashboard.guests.import.paste");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await bulkImportGuests(undefined, formData);
        if (r.success && r.data) {
          const groupsMsg =
            r.data.groupsCreated > 0
              ? t("toast.groupsSuffix", { count: r.data.groupsCreated })
              : "";
          toast.success(
            t("toast.importedTitle", { count: r.data.created }),
            `${t("toast.skippedLines", { count: r.data.skipped })}${groupsMsg}`,
          );
          onClose();
          router.refresh();
        } else if (!r.success) {
          toast.error(tc("common.errorGeneric"), r.error);
        }
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-300 hover:bg-zinc-800"
            aria-label={tc("actions.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {t.rich("instructions", {
            code: (chunks) => <code className="rounded bg-zinc-800 px-1">{chunks}</code>,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("contentLabel")}</label>
            <textarea
              name="raw"
              required
              rows={10}
              placeholder={t("placeholder")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("separatorLabel")}</label>
            <select
              name="separator"
              defaultValue="AUTO"
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="AUTO">{t("sepAuto")}</option>
              <option value="COMMA">{t("sepComma")}</option>
              <option value="SEMICOLON">{t("sepSemicolon")}</option>
              <option value="TAB">{t("sepTab")}</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {tc("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 rotate-90" />
              )}
              {t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
