import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import VendorsClient from "./vendors-client";

export const dynamic = "force-dynamic";


export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null },
    include: { budgetItems: { where: { deletedAt: null } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Fornecedores</h1>
      </div>
      <VendorsClient vendors={vendors} categories={[...CATEGORIES]} />
    </div>
  );
}
