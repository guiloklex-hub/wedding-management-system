"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ROLES, canManageUsers, type Role } from "@/lib/permissions";
import { getSecuritySettings, setSecuritySettings } from "@/lib/security-settings";
import { notify } from "@/lib/notifications";
import { coerceLocale } from "@/i18n/config";
import type { ActionResult } from "@/types";

function buildLoginUrl(): string {
  const base =
    process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3005";
  return `${base.replace(/\/$/, "")}/login`;
}

const PhoneSchema = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .refine(
    (v) => v === null || /^\+\d{10,15}$/.test(v),
    "Telefone deve estar no formato +5511999999999",
  );

async function requireManager(): Promise<
  | { ok: true; me: { id: string; email: string; role: string } }
  | { ok: false; error: string }
> {
  const session = await auth();
  const email = session?.user?.email;
  const id = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!email || !id) return { ok: false, error: "Não autorizado" };
  if (!canManageUsers(role)) return { ok: false, error: "Sem permissão" };

  const fresh = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isActive: true, archivedAt: true },
  });
  if (!fresh || !fresh.isActive || fresh.archivedAt) {
    return { ok: false, error: "Sessão inválida" };
  }
  if (!canManageUsers(fresh.role)) return { ok: false, error: "Sem permissão" };
  return { ok: true, me: { id: fresh.id, email: fresh.email, role: fresh.role } };
}

async function requireSession(): Promise<
  | { ok: true; me: { id: string; email: string; role: string } }
  | { ok: false; error: string }
> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return { ok: false, error: "Não autorizado" };
  const fresh = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isActive: true, archivedAt: true },
  });
  if (!fresh || !fresh.isActive || fresh.archivedAt) {
    return { ok: false, error: "Sessão inválida" };
  }
  return { ok: true, me: { id: fresh.id, email: fresh.email, role: fresh.role } };
}

async function countActiveAdmins(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      archivedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

function emailSchema() {
  return z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido")
    .max(160);
}

async function passwordSchema() {
  const settings = await getSecuritySettings();
  const min = settings.passwordMinLength;
  return z
    .string()
    .min(min, `Senha deve ter ao menos ${min} caracteres`)
    .max(128, "Senha muito longa");
}

const RoleSchema = z.enum(ROLES);

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  email: emailSchema(),
  phone: PhoneSchema.optional(),
  password: z.string().min(6).max(128),
  role: RoleSchema,
});

export async function createUser(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const pwSchema = await passwordSchema();
  const pwCheck = pwSchema.safeParse(parsed.data.password);
  if (!pwCheck.success) {
    return { success: false, error: pwCheck.error.issues[0]?.message ?? "Senha inválida" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { success: false, error: "Já existe um usuário com este email" };

    const hashed = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        password: hashed,
        role: parsed.data.role,
        isActive: true,
        mustChangePassword: true,
        passwordUpdatedAt: new Date(),
      },
      select: { id: true, email: true, phone: true, name: true, locale: true },
    });

    await audit("User", created.id, "CREATE", {
      email: created.email,
      role: parsed.data.role,
      by: guard.me.id,
    });

    notify(
      { userId: created.id, email: created.email, phone: created.phone, locale: coerceLocale(created.locale) },
      {
        kind: "ACCOUNT_CREATED",
        userName: created.name ?? created.email,
        tempPassword: parsed.data.password,
        loginUrl: buildLoginUrl(),
      },
      { refType: "User", refId: created.id },
    ).catch((err) => console.error("[createUser] notify falhou", err));

    revalidatePath("/dashboard/settings");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("[createUser]", err);
    return { success: false, error: "Erro ao criar usuário" };
  }
}

const UpdateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120).optional(),
  phone: PhoneSchema.optional(),
  role: RoleSchema.optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (typeof v === "boolean") return v;
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
});

export async function updateUser(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { id, name, phone, role, isActive } = parsed.data;

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true, archivedAt: true },
    });
    if (!target || target.archivedAt) return { success: false, error: "Usuário não encontrado" };

    if (id === guard.me.id) {
      if (role && role !== guard.me.role) {
        return { success: false, error: "Você não pode alterar sua própria função" };
      }
      if (isActive === false) {
        return { success: false, error: "Você não pode desativar a si mesmo" };
      }
    }

    if (target.role === "ADMIN" && (role && role !== "ADMIN" || isActive === false)) {
      const others = await countActiveAdmins(target.id);
      if (others < 1) {
        return { success: false, error: "Mantenha pelo menos um administrador ativo" };
      }
    }

    const data: Record<string, unknown> = {};
    if (typeof name === "string") data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (role) data.role = role;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (Object.keys(data).length === 0) return { success: true };

    await prisma.user.update({ where: { id }, data });
    await audit("User", id, "UPDATE", { changes: data, by: guard.me.id });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[updateUser]", err);
    return { success: false, error: "Erro ao atualizar usuário" };
  }
}

const ResetPasswordSchema = z.object({
  id: z.string().min(1).max(64),
  newPassword: z.string().min(6).max(128),
});

export async function resetUserPassword(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = ResetPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const pwSchema = await passwordSchema();
  const pwCheck = pwSchema.safeParse(parsed.data.newPassword);
  if (!pwCheck.success) {
    return { success: false, error: pwCheck.error.issues[0]?.message ?? "Senha inválida" };
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return { success: false, error: "Usuário não encontrado" };

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: target.id },
      data: {
        password: hashed,
        mustChangePassword: true,
        passwordUpdatedAt: new Date(),
      },
    });
    await audit("User", target.id, "RESET_PASSWORD", { by: guard.me.id });

    notify(
      { userId: target.id, email: target.email, phone: target.phone, locale: coerceLocale(target.locale) },
      {
        kind: "PASSWORD_RESET_BY_ADMIN",
        userName: target.name ?? target.email,
        tempPassword: parsed.data.newPassword,
        loginUrl: buildLoginUrl(),
      },
      { refType: "User", refId: target.id },
    ).catch((err) => console.error("[resetUserPassword] notify falhou", err));

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[resetUserPassword]", err);
    return { success: false, error: "Erro ao redefinir senha" };
  }
}

export async function resetUserTwoFactor(targetId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };
  if (!targetId || typeof targetId !== "string") {
    return { success: false, error: "ID inválido" };
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return { success: false, error: "Usuário não encontrado" };

    await prisma.user.update({
      where: { id: target.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorUpdatedAt: new Date(),
      },
    });
    await audit("User", target.id, "RESET_2FA", { by: guard.me.id });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[resetUserTwoFactor]", err);
    return { success: false, error: "Erro ao redefinir 2FA" };
  }
}

export async function archiveUser(targetId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    if (targetId === guard.me.id) {
      return { success: false, error: "Você não pode arquivar a si mesmo" };
    }
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.archivedAt) {
      return { success: false, error: "Usuário não encontrado" };
    }
    if (target.role === "ADMIN") {
      const others = await countActiveAdmins(target.id);
      if (others < 1) {
        return { success: false, error: "Mantenha pelo menos um administrador ativo" };
      }
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { archivedAt: new Date(), isActive: false },
    });
    await audit("User", target.id, "ARCHIVE", { by: guard.me.id });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[archiveUser]", err);
    return { success: false, error: "Erro ao arquivar usuário" };
  }
}

export async function restoreUser(targetId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return { success: false, error: "Usuário não encontrado" };
    await prisma.user.update({
      where: { id: target.id },
      data: { archivedAt: null, isActive: true },
    });
    await audit("User", target.id, "RESTORE", { by: guard.me.id });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[restoreUser]", err);
    return { success: false, error: "Erro ao restaurar usuário" };
  }
}

const ChangeOwnSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

export async function changeOwnPassword(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireSession();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = ChangeOwnSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const pwSchema = await passwordSchema();
  const pwCheck = pwSchema.safeParse(parsed.data.newPassword);
  if (!pwCheck.success) {
    return { success: false, error: pwCheck.error.issues[0]?.message ?? "Senha inválida" };
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { success: false, error: "A nova senha deve ser diferente da atual" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: guard.me.id } });
    if (!user) return { success: false, error: "Usuário não encontrado" };
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!ok) return { success: false, error: "Senha atual incorreta" };

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: false,
        passwordUpdatedAt: new Date(),
      },
    });
    await audit("User", user.id, "CHANGE_OWN_PASSWORD");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[changeOwnPassword]", err);
    return { success: false, error: "Erro ao trocar senha" };
  }
}

const UpdateOwnProfileSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
});

export async function updateOwnProfile(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireSession();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = UpdateOwnProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await prisma.user.update({
      where: { id: guard.me.id },
      data: { name: parsed.data.name },
    });
    await audit("User", guard.me.id, "UPDATE", { changes: { name: parsed.data.name }, self: true });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[updateOwnProfile]", err);
    return { success: false, error: "Erro ao atualizar perfil" };
  }
}

const SecuritySettingsSchema = z.object({
  require2FARoles: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return [] as Role[];
      try {
        const parsed = JSON.parse(v);
        if (!Array.isArray(parsed)) return [] as Role[];
        return parsed.filter((r): r is Role => (ROLES as readonly string[]).includes(r));
      } catch {
        return [] as Role[];
      }
    }),
  passwordMinLength: z.coerce.number().int().min(6).max(64),
});

export async function updateSecuritySettings(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return { success: false, error: guard.error };
  if (guard.me.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem alterar política de segurança" };
  }

  const parsed = SecuritySettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const updated = await setSecuritySettings({
      require2FARoles: parsed.data.require2FARoles,
      passwordMinLength: parsed.data.passwordMinLength,
    });
    await audit("SecuritySettings", "singleton", "UPDATE", {
      require2FARoles: updated.require2FARoles,
      passwordMinLength: updated.passwordMinLength,
      by: guard.me.id,
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("[updateSecuritySettings]", err);
    return { success: false, error: "Erro ao salvar política de segurança" };
  }
}
