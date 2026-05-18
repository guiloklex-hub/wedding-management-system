import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { canViewSensitiveFinance } from "@/lib/permissions";
import VendorsClient from "./vendors-client";

export const dynamic = "force-dynamic";


export default async function VendorsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const showFinance = canViewSensitiveFinance(role);

  const rows = await prisma.vendor.findMany({
    where: { deletedAt: null },
    include: { budgetItems: { where: { deletedAt: null } } },
    orderBy: { createdAt: "desc" },
  });

  const vendors = showFinance
    ? rows
    : rows.map((v) => ({ ...v, budgetItems: [] as typeof v.budgetItems }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Fornecedores</h1>
      </div>
      <VendorsClient vendors={vendors} categories={[...CATEGORIES]} />
    </div>
  );
}
