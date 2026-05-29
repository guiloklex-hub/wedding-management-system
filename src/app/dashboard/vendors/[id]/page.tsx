import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinance } from "@/lib/permissions";
import VendorDetailClient from "./vendor-detail-client";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dashboard.vendors.detail");
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const showFinance = canViewSensitiveFinance(role);

  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      budgetItems: { where: { deletedAt: null } },
      payments: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } },
      contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      vendorNotes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      contracts: {
        where: { deletedAt: null },
        orderBy: { version: "desc" },
        include: {
          attachments: {
            where: { kind: "CONTRACT" },
            orderBy: { version: "desc" },
            include: {
              uploadedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!vendor) return notFound();

  const sanitized = showFinance
    ? vendor
    : {
        ...vendor,
        budgetItems: [],
        payments: [],
        contracts: vendor.contracts.map((c) => ({ ...c, totalValue: null })),
      };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/vendors"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("back")}</span>
        </Link>
      </div>
      <VendorDetailClient vendor={sanitized} role={role ?? null} />
    </div>
  );
}
