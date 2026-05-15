"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ROLES, canManageUsers } from "@/lib/permissions";
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

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(ROLES).default("PLANNER"),
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function createInvite(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ token: string }>> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.email || !userId) return { success: false, error: "Não autorizado" };
  if (!canManageUsers(role)) return { success: false, error: "Sem permissão" };

  const parsed = InviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const invite = await prisma.invite.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role,
        message: parsed.data.message,
        expiresAt,
        createdBy: userId,
      },
    });
    await audit("EventSettings", invite.id, "CREATE", { invitedEmail: invite.email });
    revalidatePath("/dashboard/settings");
    return { success: true, data: { token: invite.token } };
  } catch (err) {
    console.error("[createInvite]", err);
    return { success: false, error: "Erro ao criar convite" };
  }
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) return { success: false, error: "Não autorizado" };
  if (!canManageUsers(role)) return { success: false, error: "Sem permissão" };
  try {
    await prisma.invite.delete({ where: { id: inviteId } });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[revokeInvite]", err);
    return { success: false, error: "Erro ao revogar convite" };
  }
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  const session = await auth();
  const sessionEmail = session?.user?.email?.toLowerCase();
  if (!sessionEmail) return { success: false, error: "Faça login para aceitar o convite" };

  try {
    const invite = await prisma.invite.findFirst({
      where: { token, acceptedAt: null, expiresAt: { gte: new Date() } },
    });
    if (!invite) return { success: false, error: "Convite inválido ou expirado" };
    if (invite.email.toLowerCase() !== sessionEmail) {
      return {
        success: false,
        error: `Este convite foi enviado para ${invite.email}. Faça login com este email.`,
      };
    }

    const user = await prisma.user.findUnique({ where: { email: sessionEmail } });
    if (!user) return { success: false, error: "Usuário não encontrado" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { role: invite.role },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedBy: user.id },
      }),
    ]);

    await audit("EventSettings", invite.id, "UPDATE", { acceptedBy: user.id });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[acceptInvite]", err);
    return { success: false, error: "Erro ao aceitar convite" };
  }
}
