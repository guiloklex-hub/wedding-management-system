import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import VenueDetailClient from "./venue-detail-client";

export const dynamic = "force-dynamic";

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dashboard.venues");
  const venue = await prisma.venue.findFirst({
    where: { id, deletedAt: null },
    include: {
      checklistItems: { orderBy: { sortOrder: "asc" } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!venue) return notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/venues" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
      </Link>
      <VenueDetailClient venue={venue} />
    </div>
  );
}
