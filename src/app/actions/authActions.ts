"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn, signOut, TWO_FACTOR_REQUIRED } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error.cause as { err?: { message?: string } } | undefined)?.err?.message;
      if (cause === TWO_FACTOR_REQUIRED) return TWO_FACTOR_REQUIRED;
      switch (error.type) {
        case "CredentialsSignin":
          return "Credenciais inválidas.";
        default:
          return "Algo deu errado ao fazer o login.";
      }
    }
    throw error;
  }
}

export async function registerUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!name || !email || !password) return "Preencha todos os campos.";
    if (password.length < 6) return "Senha deve ter pelo menos 6 caracteres.";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return "Email já está em uso.";

    const ownerExists = await prisma.user.findFirst({ where: { role: "OWNER" } });
    const pendingInvite = await prisma.invite.findFirst({
      where: { email, acceptedAt: null, expiresAt: { gte: new Date() } },
    });

    const role = ownerExists ? (pendingInvite?.role ?? "VIEWER") : "OWNER";
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });

    if (pendingInvite) {
      await prisma.invite.update({
        where: { id: pendingInvite.id },
        data: { acceptedAt: new Date(), acceptedBy: user.id },
      });
    }
  } catch (err) {
    console.error("[registerUser]", err);
    return "Erro ao registrar usuário.";
  }

  redirect("/login");
}

export async function logout(): Promise<void> {
  await signOut();
}
