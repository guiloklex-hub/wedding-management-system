"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, CheckCircle2, Settings, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/toast";
import { markGiftAsPixReceived } from "@/app/actions/giftActions";

export default function PixPanel({
  giftId,
  giverName,
  formattedAmount,
  pixPaidAt,
  processedAt,
  brCode,
  qrDataUrl,
  missingFields,
  pixError,
}: {
  giftId: string;
  giverName: string | null;
  formattedAmount: string | null;
  pixPaidAt: Date | null;
  processedAt: Date | null;
  brCode: string | null;
  qrDataUrl: string | null;
  missingFields: string[];
  pixError: string | null;
}) {
  const t = useTranslations("dashboard.gifts");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [createAsset, setCreateAsset] = useState(!processedAt);
  const [, startTransition] = useTransition();

  function copy() {
    if (!brCode) return;
    navigator.clipboard.writeText(brCode).then(
      () => toast.success(t("pix.toast.copied")),
      () => toast.error(t("pix.toast.error"), t("pix.toast.copyFailed")),
    );
  }

  async function handleMarkReceived() {
    setBusy(true);
    const res = await markGiftAsPixReceived(giftId, createAsset);
    setBusy(false);
    if (!res.success) {
      toast.error(t("pix.toast.error"), res.error);
      return;
    }
    toast.success(t("pix.toast.marked"));
    startTransition(() => router.refresh());
  }

  if (missingFields.length > 0) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="mb-3 flex items-center gap-2 text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t("pix.incomplete.title")}</h2>
        </div>
        <p className="mb-3 text-sm text-zinc-300">
          {t("pix.incomplete.intro")} <strong>{missingFields.join(", ")}</strong>.
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Settings className="h-4 w-4" />
          {t("pix.incomplete.goToSettings")}
        </Link>
      </div>
    );
  }

  if (pixError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-200">
        {t("pix.errorPrefix")} {pixError}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto,1fr]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt={t("pix.qrAlt")}
            width={300}
            height={300}
            className="mx-auto rounded-lg bg-white p-2"
            unoptimized
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">{t("pix.summary.title")}</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label={t("pix.summary.gift")}>{giverName ?? `#${giftId.slice(0, 6)}`}</Row>
            <Row label={t("pix.summary.value")}>
              {formattedAmount ?? <span className="text-zinc-500">{t("pix.summary.freeValue")}</span>}
            </Row>
            <Row label={t("pix.summary.status")}>
              {pixPaidAt ? (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t("pix.summary.receivedOn")}{" "}
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(pixPaidAt))}
                </span>
              ) : (
                <span className="text-amber-300">{t("pix.summary.awaiting")}</span>
              )}
            </Row>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-100">{t("pix.copyPaste.title")}</h2>
          <textarea
            readOnly
            value={brCode ?? ""}
            className="h-32 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-200 outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("pix.copyPaste.copyButton")}
          </button>
        </div>

        {!pixPaidAt ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">{t("pix.confirm.title")}</h2>
            <p className="mb-3 text-xs text-zinc-400">{t("pix.confirm.hint")}</p>
            {processedAt ? (
              <p className="mb-3 text-xs text-sky-300">{t("pix.confirm.alreadyProcessed")}</p>
            ) : (
              <label className="mb-3 flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={createAsset}
                  onChange={(e) => setCreateAsset(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800"
                />
                {t("pix.confirm.addToAsset")}
              </label>
            )}
            <button
              type="button"
              onClick={handleMarkReceived}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? t("pix.confirm.saving") : t("pix.confirm.markReceived")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-200">{children}</dd>
    </div>
  );
}
