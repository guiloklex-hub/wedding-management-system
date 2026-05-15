import Link from "next/link";
import { Heart } from "lucide-react";
import { validateResetToken } from "@/app/actions/passwordResetActions";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await validateResetToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      <div className="relative z-10 mx-auto flex w-full max-w-[420px] flex-col space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
            <Heart className="h-6 w-6 text-rose-500" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Redefinir senha
          </h1>
          <p className="text-sm text-zinc-400">
            Escolha uma nova senha para sua conta.
          </p>
        </div>

        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center shadow-xl backdrop-blur-sm">
            <p className="text-sm text-zinc-300">
              Este link é inválido ou já expirou. Solicite um novo.
            </p>
            <div className="mt-6">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-rose-500 hover:text-rose-400"
              >
                Solicitar novo link
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
