"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Sparkles, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavigatorStandalone {
  standalone?: boolean;
}

export function InstallPrompt() {
  const t = useTranslations("dashboard.home");
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Detectar plataforma do usuário
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    // Se já estiver rodando instalado, não exibe nada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as NavigatorStandalone).standalone === true;
      
    if (isStandalone) return;

    // Envolve a atualização de estado em um timeout para evitar re-render imediato
    const platformTimer = setTimeout(() => {
      if (isIos) {
        setPlatform("ios");
      } else if (isAndroid) {
        setPlatform("android");
      }
    }, 0);

    let iosShowTimer: ReturnType<typeof setTimeout> | undefined;

    if (isIos) {
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        // Exibe de forma sutil após 4 segundos no iOS
        iosShowTimer = setTimeout(() => setShow(true), 4000);
      }
    }

    // Escuta o evento de instalação padrão do Android/Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      clearTimeout(platformTimer);
      if (iosShowTimer) clearTimeout(iosShowTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
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
        aria-label={t("install.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20 text-rose-400">
          <Download className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-rose-100 font-serif flex items-center gap-1.5">
            {t("install.title")} <Sparkles className="h-4 w-4 text-rose-400 animate-pulse" />
          </h3>

          {platform === "ios" ? (
            <div className="mt-2 text-xs text-zinc-300 space-y-2">
              <p>{t("install.iosBody")}</p>
              <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1 text-zinc-200 border border-zinc-800/80">
                <span>{t("install.iosTap")}</span>
                <Share className="h-3.5 w-3.5 mx-0.5 text-sky-400 inline" />
                <span>{t("install.iosShare")} &rarr; <strong>{t("install.iosAddToHome")}</strong></span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-300">
              <p>{t("install.androidBody")}</p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors active:scale-[0.98]"
              >
                {t("install.installButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
