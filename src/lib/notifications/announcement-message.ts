import { formatDate } from "@/i18n/format";
import { coerceLocale } from "@/i18n/config";

/**
 * Mensagem dos avisos — helpers puros compartilhados pelo template (servidor) e
 * pelo preview (client). Nenhuma tag é obrigatória.
 */

export const ANNOUNCEMENT_TAGS = [
  "nomes",
  "convidados",
  "data",
  "local",
  "site",
  "site-presentes",
  "link-rsvp",
  "pin",
] as const;

export type AnnouncementTag = (typeof ANNOUNCEMENT_TAGS)[number];
export type AnnouncementTagValues = Record<AnnouncementTag, string>;

/** Tags que viram link clicável no e-mail. */
export const ANNOUNCEMENT_LINK_TAGS: ReadonlySet<AnnouncementTag> = new Set([
  "site",
  "site-presentes",
  "link-rsvp",
]);

const KNOWN = new Set<string>(ANNOUNCEMENT_TAGS);
const TAG_RE = /\{([\w-]+)\}/g;

/**
 * Substitui as tags conhecidas numa única passada: o valor inserido nunca é
 * reprocessado (um nome contendo "{site}" fica literal) e tags desconhecidas
 * permanecem como estão.
 */
export function replaceAnnouncementTags(
  template: string,
  resolve: (tag: AnnouncementTag) => string,
): string {
  return template.replace(TAG_RE, (match, key: string) =>
    KNOWN.has(key) ? resolve(key as AnnouncementTag) : match,
  );
}

export function renderAnnouncementText(template: string, values: AnnouncementTagValues): string {
  return replaceAnnouncementTags(template, (tag) => values[tag]);
}

export function findUnknownAnnouncementTags(template: string): string[] {
  const unknown = new Set<string>();
  for (const m of template.matchAll(TAG_RE)) {
    if (!KNOWN.has(m[1])) unknown.add(m[1]);
  }
  return [...unknown];
}

export function announcementUsesTag(template: string, tag: AnnouncementTag): boolean {
  return template.includes(`{${tag}}`);
}

/** Data do evento por extenso no idioma do destinatário (mesma regra do Save the Date). */
export function formatAnnouncementDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, coerceLocale(locale), {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
