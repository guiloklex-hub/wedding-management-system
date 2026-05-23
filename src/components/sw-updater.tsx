"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function ServiceWorkerUpdater() {
  const [show, setShow] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Só roda em produção para evitar conflito com hot-reload no dev
    if (process.env.NODE_ENV !== "production") return;

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      if (!reg.waiting) return;
      setWaitingWorker(reg.waiting);
      setShow(true);
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // Se já houver um worker esperando atualização
      if (reg.waiting) {
        handleUpdate(reg);
      }

      // Escuta novas atualizações encontradas
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShow(true);
          }
        });
      });
    });

    // Escuta mudanças de controle para recarregar a página
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const handleReload = () => {
    if (!waitingWorker) return;
    // Envia mensagem SKIP_WAITING para o Service Worker
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex max-w-sm flex-col gap-3 rounded-2xl border border-rose-500/30 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md animate-slide-up sm:bottom-6 sm:left-auto sm:right-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-100 font-serif">Nova atualização disponível!</h4>
          <p className="mt-1 text-xs text-zinc-300">
            Atualizamos o Wedding Finance Planner com melhorias de UI e novos recursos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleReload}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors active:scale-[0.98]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Recarregar e Atualizar
      </button>
    </div>
  );
}
