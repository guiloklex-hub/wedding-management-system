"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClasses =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-500"
      : "bg-rose-600 hover:bg-rose-500";

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3">
            {tone === "danger" ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              </div>
            ) : null}
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          {description ? (
            <p className="text-sm text-zinc-400 whitespace-pre-line">{description}</p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${confirmClasses}`}
            >
              {busy ? "Aguarde..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
