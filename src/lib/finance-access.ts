import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canViewSensitiveFinance } from "./permissions";

function getRole(user: unknown): string | undefined {
  return (user as { role?: string } | undefined)?.role;
}

/**
 * Server-side guard for finance-sensitive pages.
 * Redirects unauthenticated users to /login and PLANNER/FAMILY/VIEWER away from /dashboard.
 * Returns the session for downstream use.
 */
export async function requireFinanceAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewSensitiveFinance(getRole(session.user))) {
    redirect("/dashboard");
  }
  return session;
}

export async function hasFinanceAccess(): Promise<boolean> {
  const session = await auth();
  return canViewSensitiveFinance(getRole(session?.user));
}

/**
 * Returns null if user can access finance, or an ActionResult error otherwise.
 * Use inside Server Actions: `const denied = await denyIfNoFinance(); if (denied) return denied;`.
 */
export async function denyIfNoFinance(): Promise<
  | { success: false; error: string }
  | null
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };
  if (!canViewSensitiveFinance(getRole(session.user))) {
    return { success: false, error: "Sem permissão para esta área" };
  }
  return null;
}
