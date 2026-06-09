"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/types";

type Props = {
  /** Thunk que chama a Server Action de IA. Callers com parâmetros usam closure. */
  action: () => Promise<ActionResult<string>>;
  /** Namespace i18n com as chaves específicas da feature: `button`, `generating`. */
  namespace: string;
  /** Chamado quando o usuário aceita o texto (ex.: jogar num campo de domínio). */
  onAccept?: (text: string) => void;
};

/**
 * Botão reutilizável "Gerar com IA": dispara a action, mostra loading e
 * apresenta o resultado num bloco editável/copiável com selo "Gerado por IA" e
 * aviso de revisão. O texto NUNCA é persistido aqui — o usuário revisa antes.
 */
export function AiGenerateButton({ action, namespace, onAccept }: Props) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common.ai");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run() {
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        setResult(r.data ?? "");
        setCopied(false);
      } else {
        toast.error(tc("failed"), r.error);
      }
    });
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tc("failed"));
    }
  }

  if (result === null) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {pending ? t("generating") : t("button")}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-200">
        <Sparkles className="h-3 w-3" />
        {tc("generatedBadge")}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{result}</p>
      <p className="mt-3 text-xs text-zinc-500">{tc("reviewNotice")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? tc("copied") : tc("copy")}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {tc("regenerate")}
        </button>
        {onAccept ? (
          <button
            type="button"
            onClick={() => onAccept(result)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
          >
            {tc("use")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
