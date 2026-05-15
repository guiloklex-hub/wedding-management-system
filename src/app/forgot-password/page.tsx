import { Heart } from "lucide-react";
import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      <div className="relative z-10 mx-auto flex w-full max-w-[420px] flex-col space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
            <Heart className="h-6 w-6 text-rose-500" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Esqueceu sua senha?
          </h1>
          <p className="text-sm text-zinc-400">
            Informe seu email e enviaremos um link para redefini-la por
            email e WhatsApp (se cadastrado).
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
