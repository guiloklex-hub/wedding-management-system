"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/toast";

export function WebShare({
  title,
  text,
  url,
  label = "Compartilhar",
  className = "",
}: {
  title: string;
  text: string;
  url: string;
  label?: string;
  className?: string;
}) {
  const toast = useToast();

  const handleShare = async () => {
    // Garante que a URL é absoluta
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${window.location.origin}${url}`;

    const shareData = {
      title,
      text,
      url: absoluteUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignora se o usuário cancelou o prompt nativo de compartilhamento
        if ((err as Error).name !== "AbortError") {
          console.warn("[Share] failed sharing:", err);
        }
      }
    } else {
      // Fallback resiliente: copia o link para a área de transferência
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        toast.success("Link copiado!", "O link foi copiado para a sua área de transferência.");
      } catch (err) {
        toast.error("Erro ao copiar", "Não foi possível copiar o link.");
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 px-3.5 py-2.5 text-xs font-semibold text-zinc-100 transition-colors border border-zinc-700/40 active:scale-[0.98] ${className}`}
    >
      <Share2 className="h-3.5 w-3.5 text-rose-400" />
      <span>{label}</span>
    </button>
  );
}
