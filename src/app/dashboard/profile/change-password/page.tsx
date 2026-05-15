import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSecuritySettings } from "@/lib/security-settings";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id },
    select: { email: true, mustChangePassword: true, name: true },
  });
  if (!me) redirect("/login");

  const settings = await getSecuritySettings();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {me.mustChangePassword ? "Defina sua senha" : "Trocar minha senha"}
        </h1>
        <p className="text-sm text-zinc-500">
          {me.mustChangePassword
            ? "Você está usando uma senha provisória. Defina uma senha definitiva para continuar."
            : "Atualize sua senha periodicamente para manter sua conta segura."}
        </p>
      </div>

      <ChangePasswordForm
        required={me.mustChangePassword}
        minPasswordLength={settings.passwordMinLength}
        email={me.email}
      />
    </div>
  );
}
