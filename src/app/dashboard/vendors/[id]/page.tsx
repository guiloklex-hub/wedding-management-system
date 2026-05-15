import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import VendorDetailClient from "./vendor-detail-client";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      budgetItems: { where: { deletedAt: null } },
      payments: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } },
      contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      vendorNotes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      contracts: { where: { deletedAt: null }, orderBy: { version: "desc" } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!vendor) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/vendors"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para fornecedores</span>
        </Link>
      </div>
      <VendorDetailClient vendor={vendor} />
    </div>
  );
}
