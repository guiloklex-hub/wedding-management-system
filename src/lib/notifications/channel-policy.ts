import type { Locale } from "@/i18n/config";
import { notify, type NotifyMedia } from "./index";
import type { RenderInput } from "./templates";

export type ChannelPolicy = "AUTO" | "WHATSAPP" | "EMAIL";

export type DeliveryResult = {
  ok: boolean;
  channelUsed?: "WHATSAPP" | "EMAIL";
  error?: string;
};

/**
 * Envia por um único canal por vez. AUTO tenta WhatsApp primeiro e cai para
 * e-mail quando o WhatsApp falha ou não existe; WHATSAPP/EMAIL não fazem fallback.
 */
export async function deliverByChannel(args: {
  policy: ChannelPolicy;
  phone: string | null;
  email: string | null;
  locale: Locale;
  input: RenderInput;
  refType?: string;
  refId?: string;
  media?: NotifyMedia;
}): Promise<DeliveryResult> {
  const { policy, phone, email, locale, input, refType, refId, media } = args;
  const options = { refType, refId, media };
  const viaWhatsApp = () => notify({ phone, locale }, input, options);
  const viaEmail = () => notify({ email, locale }, input, options);

  if (policy === "WHATSAPP") {
    if (!phone) return { ok: false, error: "NO_PHONE" };
    const res = await viaWhatsApp();
    if (res.whatsapp.ok) return { ok: true, channelUsed: "WHATSAPP" };
    return { ok: false, error: res.whatsapp.error || "WHATSAPP_FAILED" };
  }

  if (policy === "EMAIL") {
    if (!email) return { ok: false, error: "NO_EMAIL" };
    const res = await viaEmail();
    if (res.email.ok) return { ok: true, channelUsed: "EMAIL" };
    return { ok: false, error: res.email.error || "EMAIL_FAILED" };
  }

  if (phone) {
    const waRes = await viaWhatsApp();
    if (waRes.whatsapp.ok) return { ok: true, channelUsed: "WHATSAPP" };
    if (email) {
      const emailRes = await viaEmail();
      if (emailRes.email.ok) return { ok: true, channelUsed: "EMAIL" };
      return {
        ok: false,
        error: `WhatsApp: ${waRes.whatsapp.error || "Failed"}; Email: ${emailRes.email.error || "Failed"}`,
      };
    }
    return { ok: false, error: waRes.whatsapp.error || "WHATSAPP_FAILED" };
  }

  if (email) {
    const emailRes = await viaEmail();
    if (emailRes.email.ok) return { ok: true, channelUsed: "EMAIL" };
    return { ok: false, error: emailRes.email.error || "EMAIL_FAILED" };
  }

  return { ok: false, error: "NO_CONTACT" };
}
