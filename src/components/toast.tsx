"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  expiresAt: number;
};

type ToastContextValue = {
  push: (input: { tone?: ToastTone; title: string; description?: string; durationMs?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    ({ tone = "info", title, description, durationMs = DEFAULT_DURATION }) => {
      const id = Math.random().toString(36).slice(2, 10);
      const expiresAt = Date.now() + durationMs;
      setToasts((current) => [...current, { id, tone, title, description, expiresAt }]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ tone: "success", title, description }),
      error: (title, description) => push({ tone: "error", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const palette: Record<ToastTone, { ring: string; icon: ReactNode; text: string }> = {
    success: {
      ring: "border-emerald-500/30 bg-emerald-500/10",
      text: "text-emerald-100",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    },
    error: {
      ring: "border-rose-500/30 bg-rose-500/10",
      text: "text-rose-100",
      icon: <AlertTriangle className="h-5 w-5 text-rose-400" />,
    },
    info: {
      ring: "border-sky-500/30 bg-sky-500/10",
      text: "text-sky-100",
      icon: <Info className="h-5 w-5 text-sky-400" />,
    },
  };
  const tones = palette[toast.tone];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur shadow-lg ${tones.ring}`}
    >
      <div className="mt-0.5">{tones.icon}</div>
      <div className={`flex-1 ${tones.text}`}>
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-xs opacity-80">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-zinc-300 transition-colors hover:bg-white/10"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
