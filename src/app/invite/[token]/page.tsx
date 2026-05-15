import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AcceptInviteButton from "./accept-button";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  PARTNER: "Parceiro(a) — pode editar tudo",
  VIEWER: "Leitura — só visualiza",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findFirst({
    where: { token, acceptedAt: null, expiresAt: { gte: new Date() } },
  });
  if (!invite) return notFound();

  const session = await auth();
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
  const matches = sessionEmail === invite.email.toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-zinc-950 to-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-rose-500/20 bg-zinc-950/80 p-8 shadow-2xl">
        <p className="text-center text-xs uppercase tracking-widest text-rose-300">Convite</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-white">
          Você foi convidado para colaborar
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-300">
          Convite enviado para <span className="font-semibold">{invite.email}</span>.
        </p>
        <p className="mt-1 text-center text-sm text-zinc-400">
          Permissão: <span className="text-white">{ROLE_LABEL[invite.role] ?? invite.role}</span>
        </p>
        {invite.message ? (
          <blockquote className="mt-4 rounded-xl border-l-2 border-rose-400 bg-rose-500/5 p-3 text-sm text-zinc-200">
            {invite.message}
          </blockquote>
        ) : null}

        {!sessionEmail ? (
          <div className="mt-6 space-y-2 text-center text-sm text-zinc-300">
            <p>Para aceitar, faça login com o email convidado.</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                className="rounded-xl bg-rose-600 py-2.5 text-white hover:bg-rose-500"
              >
                Já tenho conta — entrar
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-zinc-800 py-2.5 text-white hover:bg-zinc-700"
              >
                Criar conta com este email
              </Link>
            </div>
          </div>
        ) : matches ? (
          <AcceptInviteButton token={invite.token} />
        ) : (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
            Você está logado como <span className="font-semibold">{sessionEmail}</span>, mas o
            convite é para <span className="font-semibold">{invite.email}</span>. Faça logout e
            entre com o email correto.
          </div>
        )}
      </div>
    </div>
  );
}
