"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import {
  disconnectWhatsApp,
  ensureWhatsAppStarted,
  getQrDataUrl,
  getWhatsAppStatus,
  sendWhatsApp,
} from "@/lib/notifications/whatsapp";
import type { ActionResult } from "@/types";

export type WhatsAppStatusPayload = {
  state: "DISCONNECTED" | "CONNECTING" | "WAITING_QR" | "CONNECTED";
  phoneNumber: string | null;
  lastError: string | null;
  qrDataUrl: string | null;
  attempts: number;
  lastDisconnectAt: string | null;
  needsManualAction: boolean;
};

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId) return { ok: false, error: "Não autorizado" };
  if (role !== "ADMIN") return { ok: false, error: "Apenas administradores" };
  return { ok: true, userId };
}

export async function getWhatsAppStatusAction(): Promise<WhatsAppStatusPayload> {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return {
      state: "DISCONNECTED",
      phoneNumber: null,
      lastError: guard.error,
      qrDataUrl: null,
      attempts: 0,
      lastDisconnectAt: null,
      needsManualAction: false,
    };
  }
  const status = getWhatsAppStatus();
  const qrDataUrl = status.state === "WAITING_QR" ? await getQrDataUrl() : null;
  return {
    state: status.state,
    phoneNumber: status.phoneNumber,
    lastError: status.lastError,
    qrDataUrl,
    attempts: status.attempts,
    lastDisconnectAt: status.lastDisconnectAt
      ? status.lastDisconnectAt.toISOString()
      : null,
    needsManualAction: status.needsManualAction,
  };
}

export async function connectWhatsApp(): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await ensureWhatsAppStarted();
    await audit("User", guard.userId, "UPDATE", { whatsapp: "connect_started" });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function disconnectWhatsAppAction(): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await disconnectWhatsApp();
    await audit("User", guard.userId, "UPDATE", { whatsapp: "disconnected" });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

const TestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{10,15}$/, "Use o formato +5511999999999"),
});

export async function sendWhatsAppTest(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = TestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Telefone inválido",
    };
  }

  const result = await sendWhatsApp(
    parsed.data.phone,
    "*Wedding Finance*\n\nMensagem de teste enviada com sucesso. Sua integração com WhatsApp está funcionando. ✅",
  );

  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}
