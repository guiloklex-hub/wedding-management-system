"use client";

import { useEffect, useState } from "react";
import { Download, Sparkles, X, Share } from "lucide-react";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detectar plataforma do usuário
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    // Se já estiver rodando instalado, não exibe nada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;
      
    if (isStandalone) return;

    if (isIos) {
      setPlatform("ios");
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        // Exibe de forma sutil após 4 segundos no iOS
        const timer = setTimeout(() => setShow(true), 4000);
        return () => clearTimeout(timer);
      }
    } else if (isAndroid) {
      setPlatform("android");
    }

    // Escuta o evento de instalação padrão do Android/Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    // Não exibe novamente na sessão atual do navegador
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!show) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-zinc-900/30 p-5 shadow-xl backdrop-blur-sm animate-fade-in">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
        aria-label="Ignorar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20 text-rose-400">
          <Download className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-rose-100 font-serif flex items-center gap-1.5">
            Instalar no Celular <Sparkles className="h-4 w-4 text-rose-400 animate-pulse" />
          </h3>

          {platform === "ios" ? (
            <div className="mt-2 text-xs text-zinc-300 space-y-2">
              <p>
                Adicione o Wedding Finance Planner diretamente na tela de início do seu iPhone para uma experiência em tela cheia idêntica a um app nativo:
              </p>
              <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1 text-zinc-200 border border-zinc-800/80">
                <span>Toque em</span>
                <Share className="h-3.5 w-3.5 mx-0.5 text-sky-400 inline" />
                <span>Compartilhar &rarr; <strong>Adicionar à Tela de Início</strong></span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-300">
              <p>
                Adicione o aplicativo Wedding Finance Planner à sua tela de início para acompanhar suas finanças e tarefas de forma ágil, com acesso rápido e notificações.
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors active:scale-[0.98]"
              >
                Instalar Aplicativo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
