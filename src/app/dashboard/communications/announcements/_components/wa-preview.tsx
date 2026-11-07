"use client";

import { FileText } from "lucide-react";

export type PreviewArt = { src: string | null; name: string; isImage: boolean };

export function WaPreview({ text, art, emptyLabel }: { text: string; art: PreviewArt | null; emptyLabel: string }) {
  return (
    <div className="rounded-2xl bg-[#0b141a] p-4">
      <div className="ml-auto max-w-sm rounded-xl rounded-tr-sm bg-[#005c4b] p-3 text-sm text-zinc-50 shadow">
        {art && (
          <div className="mb-2 overflow-hidden rounded-lg">
            {art.isImage && art.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art.src} alt={art.name} className="w-full object-cover" />
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-black/30 p-3">
                <FileText className="h-8 w-8 shrink-0" />
                <span className="truncate text-xs">{art.name}</span>
              </div>
            )}
          </div>
        )}
        {text ? (
          <p className="whitespace-pre-wrap break-words">{text}</p>
        ) : (
          <p className="italic text-zinc-300/70">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
