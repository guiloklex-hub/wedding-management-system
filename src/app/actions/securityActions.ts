"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import {
  checkBackupCode,
  createTotpSetup,
  generateBackupCodes,
  verifyTotpToken,
} from "@/lib/totp";
import type { ActionResult } from "@/types";

export async function startTwoFactorSetup(): Promise<
  ActionResult<{ secret: string; qrCodeSvg: string; otpauthUrl: string }>
> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Não autorizado" };
  try {
    const setup = await createTotpSetup(session.user.email, "Wedding Finance");
    return { success: true, data: setup };
  } catch (err) {
    console.error("[startTwoFactorSetup]", err);
    return { success: false, error: "Erro ao gerar configuração 2FA" };
  }
}

const ConfirmSchema = z.object({
  secret: z.string().trim().min(8).max(120),
  token: z.string().trim().regex(/^\d{6}$/),
});

export async function confirmTwoFactor(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ backupCodes: string[] }>> {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) return { success: false, error: "Não autorizado" };

  const parsed = ConfirmSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: "Código inválido" };
  }
  if (!verifyTotpToken(parsed.data.token, parsed.data.secret)) {
    return { success: false, error: "Código TOTP inválido" };
  }

  try {
    const backupCodes = generateBackupCodes(8);
    await prisma.user.update({
      where: { email: userEmail },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: parsed.data.secret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });
    await audit("EventSettings", userEmail, "UPDATE", { enabled2FA: true });
    revalidatePath("/dashboard/settings");
    return { success: true, data: { backupCodes } };
  } catch (err) {
    console.error("[confirmTwoFactor]", err);
    return { success: false, error: "Erro ao ativar 2FA" };
  }
}

const DisableSchema = z.object({
  token: z.string().trim().min(6).max(20),
});

export async function disableTwoFactor(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) return { success: false, error: "Não autorizado" };

  const parsed = DisableSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: "Código obrigatório" };

  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return { success: false, error: "2FA não está ativo" };
    }

    const isTotp = verifyTotpToken(parsed.data.token, user.twoFactorSecret);
    let isBackup = false;
    let remaining: string[] = [];
    if (!isTotp) {
      const check = checkBackupCode(parsed.data.token, user.twoFactorBackupCodes);
      isBackup = check.valid;
      remaining = check.remaining;
    }
    if (!isTotp && !isBackup) return { success: false, error: "Código inválido" };

    await prisma.user.update({
      where: { email: userEmail },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: isBackup ? JSON.stringify(remaining) : null,
      },
    });
    await audit("EventSettings", userEmail, "UPDATE", { enabled2FA: false });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[disableTwoFactor]", err);
    return { success: false, error: "Erro ao desativar 2FA" };
  }
}

