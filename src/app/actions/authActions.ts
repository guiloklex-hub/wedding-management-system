"use server";

import { AuthError } from "next-auth";
import {
  signIn,
  signOut,
  TWO_FACTOR_REQUIRED,
  TWO_FACTOR_SETUP_REQUIRED,
  ACCOUNT_DISABLED,
} from "@/auth";

function safeRedirect(input: FormDataEntryValue | null | undefined): string {
  if (typeof input !== "string" || !input) return "/dashboard";
  if (!input.startsWith("/") || input.startsWith("//")) return "/dashboard";
  if (input === "/login" || input.startsWith("/login?") || input.startsWith("/login/")) {
    return "/dashboard";
  }
  return input;
}

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  formData.set("redirectTo", safeRedirect(formData.get("redirectTo")));

  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error.cause as { err?: { message?: string } } | undefined)?.err?.message;
      if (cause === TWO_FACTOR_REQUIRED) return TWO_FACTOR_REQUIRED;
      if (cause === TWO_FACTOR_SETUP_REQUIRED) return TWO_FACTOR_SETUP_REQUIRED;
      if (cause === ACCOUNT_DISABLED) return ACCOUNT_DISABLED;
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

export async function logout(): Promise<void> {
  await signOut();
}
