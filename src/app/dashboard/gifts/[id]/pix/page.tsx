import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { canEdit } from "@/lib/permissions";
import { generateBrCode } from "@/lib/pix";
import { formatCurrency } from "@/lib/format";
import PixPanel from "./pix-panel";

export const dynamic = "force-dynamic";

export default async function GiftPixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!canEdit(role)) redirect("/dashboard");

  const { id } = await params;
  const gift = await prisma.gift.findFirst({
    where: { id },
  });
  if (!gift) return notFound();

  const cfg = await getEventConfig();
  const missingFields: string[] = [];
  if (!cfg.pixKey) missingFields.push("chave Pix");
  if (!cfg.pixHolderName) missingFields.push("nome do recebedor");
  if (!cfg.pixCity) missingFields.push("cidade");

  const amount = typeof gift.amount === "number" && gift.amount > 0 ? gift.amount : undefined;

  let brCode: string | null = null;
  let qrDataUrl: string | null = null;
  let pixError: string | null = null;

  if (missingFields.length === 0) {
    try {
      brCode = generateBrCode({
        key: cfg.pixKey!,
        merchantName: cfg.pixHolderName!,
        merchantCity: cfg.pixCity!,
        amount,
        txid: gift.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 25),
      });
      qrDataUrl = await QRCode.toDataURL(brCode, { width: 360, margin: 1 });
    } catch (err) {
      console.error("[gift pix]", err);
      pixError = err instanceof Error ? err.message : "Erro ao gerar QR Code";
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/gifts"
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100">QR Code Pix</h1>
      </header>

      <PixPanel
        giftId={gift.id}
        giverName={gift.giverName}
        formattedAmount={amount ? formatCurrency(amount, cfg.currency) : null}
        pixPaidAt={gift.pixPaidAt}
        brCode={brCode}
        qrDataUrl={qrDataUrl}
        missingFields={missingFields}
        pixError={pixError}
      />
    </div>
  );
}
