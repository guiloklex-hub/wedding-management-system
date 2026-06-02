import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsApp, isValidPhone, getWhatsAppStatus } from "./whatsapp";
import { logNotification } from "./log";
import { render, type RenderInput } from "./templates";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

export type NotifyTarget = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  locale?: Locale | null;
};

export type NotifyMedia = {
  data: Buffer;
  mimeType: string;
  filename: string;
  /** Quando definido e a mídia for imagem, embute inline no HTML do e-mail via cid. */
  inlineCid?: string;
};

export type NotifyOptions = {
  refType?: string;
  refId?: string;
  media?: NotifyMedia;
};

export type NotifyResult = {
  email: { attempted: boolean; ok: boolean; error?: string };
  whatsapp: { attempted: boolean; ok: boolean; error?: string };
};

export async function notify(
  target: NotifyTarget,
  input: RenderInput,
  options: NotifyOptions = {},
): Promise<NotifyResult> {
  const locale: Locale = (input as { locale?: Locale }).locale ?? target.locale ?? DEFAULT_LOCALE;
  const rendered = await render({ ...input, locale } as RenderInput);
  const result: NotifyResult = {
    email: { attempted: false, ok: false },
    whatsapp: { attempted: false, ok: false },
  };

  const wantsEmail = Boolean(target.email && isEmailConfigured());
  const wantsWa = Boolean(target.phone && isValidPhone(target.phone));

  const media = options.media;
  const isImage = media ? media.mimeType.startsWith("image/") : false;
  const emailAttachments = media
    ? [
        {
          filename: media.filename,
          content: media.data,
          contentType: media.mimeType,
          ...(isImage && media.inlineCid ? { cid: media.inlineCid } : {}),
        },
      ]
    : undefined;

  const emailPromise = wantsEmail
    ? sendEmail({
        to: target.email!,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: emailAttachments,
      })
    : Promise.resolve(null);

  const waStatus = getWhatsAppStatus();
  const waPromise =
    wantsWa && (waStatus.state === "CONNECTED" || waStatus.state === "DISCONNECTED")
      ? sendWhatsApp(target.phone!, rendered.waText, media)
      : Promise.resolve(
          wantsWa
            ? { ok: false as const, error: `WhatsApp em estado ${waStatus.state}` }
            : null,
        );

  const [emailRes, waRes] = await Promise.allSettled([emailPromise, waPromise]);

  if (wantsEmail) {
    result.email.attempted = true;
    if (emailRes.status === "fulfilled" && emailRes.value && emailRes.value.ok) {
      result.email.ok = true;
      await logNotification({
        kind: input.kind,
        channel: "EMAIL",
        userId: target.userId ?? null,
        targetEmail: target.email ?? null,
        status: "SENT",
        refType: options.refType,
        refId: options.refId,
      });
    } else {
      const error =
        emailRes.status === "rejected"
          ? emailRes.reason instanceof Error
            ? emailRes.reason.message
            : String(emailRes.reason)
          : emailRes.value && !emailRes.value.ok
            ? emailRes.value.error
            : "Erro desconhecido";
      result.email.error = error;
      await logNotification({
        kind: input.kind,
        channel: "EMAIL",
        userId: target.userId ?? null,
        targetEmail: target.email ?? null,
        status: "FAILED",
        errorMsg: error,
        refType: options.refType,
        refId: options.refId,
      });
    }
  }

  if (wantsWa) {
    result.whatsapp.attempted = true;
    if (waRes.status === "fulfilled" && waRes.value && waRes.value.ok) {
      result.whatsapp.ok = true;
      await logNotification({
        kind: input.kind,
        channel: "WHATSAPP",
        userId: target.userId ?? null,
        targetPhone: target.phone ?? null,
        status: "SENT",
        refType: options.refType,
        refId: options.refId,
      });
    } else {
      const error =
        waRes.status === "rejected"
          ? waRes.reason instanceof Error
            ? waRes.reason.message
            : String(waRes.reason)
          : waRes.value && !waRes.value.ok
            ? waRes.value.error
            : "Erro desconhecido";
      result.whatsapp.error = error;
      await logNotification({
        kind: input.kind,
        channel: "WHATSAPP",
        userId: target.userId ?? null,
        targetPhone: target.phone ?? null,
        status: "FAILED",
        errorMsg: error,
        refType: options.refType,
        refId: options.refId,
      });
    }
  }

  return result;
}
