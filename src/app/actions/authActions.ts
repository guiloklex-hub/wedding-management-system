"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
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

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, password: hashed, role: "USER" },
    });
  } catch (err) {
    console.error("[registerUser]", err);
    return "Erro ao registrar usuário.";
  }

  redirect("/login");
}

export async function logout(): Promise<void> {
  await signOut();
}
