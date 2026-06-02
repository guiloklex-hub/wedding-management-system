import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/storage";
import { getEventConfig } from "@/lib/event-config";
import { coerceLocale, type Locale } from "@/i18n/config";
import { notify, type NotifyMedia, type NotifyResult, type NotifyTarget } from "./index";

export const SAVE_THE_DATE_ART_CID = "savethedate-art";

export type SaveTheDateContext = {
  coupleNames: string;
  eventDate: Date;
  venueName: string | null;
  websiteUrl: string | null;
  giftRegistryUrl: string | null;
  customMessage: string | null;
  media?: NotifyMedia;
  defaultLocale: Locale;
};

export type SaveTheDateContextResult =
  | { ok: true; ctx: SaveTheDateContext }
  | { ok: false; error: "EVENT_NOT_CONFIGURED" };

/**
 * Carrega tudo que o Save the Date precisa: dados do evento, links externos,
 * a mensagem personalizada e a arte (lida uma vez do disco, reutilizável por
 * destinatário). A arte ausente não é erro — manda só o texto.
 */
export async function loadSaveTheDateContext(): Promise<SaveTheDateContextResult> {
  const cfg = await getEventConfig();
  if (!cfg.eventDate || !cfg.coupleNames) {
    return { ok: false, error: "EVENT_NOT_CONFIGURED" };
  }

  let media: NotifyMedia | undefined;
  if (cfg.saveTheDateFilePath && cfg.saveTheDateFileMime && cfg.saveTheDateFileName) {
    try {
      const data = await readUpload(cfg.saveTheDateFilePath);
      media = {
        data,
        mimeType: cfg.saveTheDateFileMime,
        filename: cfg.saveTheDateFileName,
        inlineCid: cfg.saveTheDateFileMime.startsWith("image/")
          ? SAVE_THE_DATE_ART_CID
          : undefined,
      };
    } catch (err) {
      console.error("[save-the-date] falha ao ler a arte", err);
      media = undefined;
    }
  }

  const venue = await prisma.venue.findFirst({
    where: { deletedAt: null },
    orderBy: [{ isShortlisted: "desc" }, { createdAt: "asc" }],
    select: { name: true },
  });

  return {
    ok: true,
    ctx: {
      coupleNames: cfg.coupleNames,
      eventDate: cfg.eventDate,
      venueName: venue?.name ?? null,
      websiteUrl: cfg.weddingWebsiteUrl,
      giftRegistryUrl: cfg.giftRegistryUrl,
      customMessage: cfg.saveTheDateMessage,
      media,
      defaultLocale: cfg.defaultLocale,
    },
  };
}

export async function sendSaveTheDate(args: {
  ctx: SaveTheDateContext;
  target: NotifyTarget;
  recipientNames: string;
  refType: string;
  refId: string;
}): Promise<NotifyResult> {
  const locale = args.target.locale ?? args.ctx.defaultLocale;
  return notify(
    args.target,
    {
      kind: "SAVE_THE_DATE",
      locale,
      coupleNames: args.ctx.coupleNames,
      eventDate: args.ctx.eventDate,
      venueName: args.ctx.venueName,
      recipientNames: args.recipientNames,
      websiteUrl: args.ctx.websiteUrl,
      giftRegistryUrl: args.ctx.giftRegistryUrl,
      customMessage: args.ctx.customMessage,
      imageCid: args.ctx.media?.inlineCid ?? null,
    },
    { refType: args.refType, refId: args.refId, media: args.ctx.media },
  );
}

export function resolveTargetLocale(
  recipientLocale: string | null,
  fallback: Locale,
): Locale {
  return recipientLocale ? coerceLocale(recipientLocale) : fallback;
}
