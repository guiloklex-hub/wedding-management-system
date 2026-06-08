import { CalendarHeart, CloudRain, Clock, ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { daysUntil, type EventConfig } from "@/lib/event-config";
import type { Locale } from "@/i18n/config";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Seção de boas-vindas exibida acima do formulário de RSVP (individual e grupo).
 * Mostra contagem regressiva, programação do dia, plano B (chuva) e link do site —
 * tudo de `EventConfig`. Server component (sem estado): a contagem é do servidor.
 */
export async function RsvpLanding({ cfg, locale }: { cfg: EventConfig; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "rsvp.landing" });
  const days = cfg.eventDate ? daysUntil(cfg.eventDate) : null;
  const showCountdown = days !== null && days >= 0;
  const website = cfg.weddingWebsiteUrl && isHttpUrl(cfg.weddingWebsiteUrl) ? cfg.weddingWebsiteUrl : null;

  if (!showCountdown && !cfg.daySchedule && !cfg.rainPlanB && !website) return null;

  return (
    <div className="mt-5 space-y-3">
      {showCountdown ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-rose-200">
          <CalendarHeart className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">
            {days === 0 ? t("today") : t("countdown", { days: days as number })}
          </span>
        </div>
      ) : null}

      {cfg.daySchedule ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <Clock className="h-3.5 w-3.5" /> {t("schedule")}
          </p>
          <p className="whitespace-pre-line text-sm text-zinc-200">{cfg.daySchedule}</p>
        </div>
      ) : null}

      {cfg.rainPlanB ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <CloudRain className="h-3.5 w-3.5" /> {t("rainPlan")}
          </p>
          <p className="whitespace-pre-line text-sm text-zinc-200">{cfg.rainPlanB}</p>
        </div>
      ) : null}

      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
        >
          <ExternalLink className="h-4 w-4" /> {t("website")}
        </a>
      ) : null}
    </div>
  );
}
