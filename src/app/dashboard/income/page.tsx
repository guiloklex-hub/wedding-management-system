import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireFinanceAccess } from "@/lib/finance-access";
import IncomeClient from "./income-client";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  await requireFinanceAccess();
  const t = await getTranslations("dashboard.income");

  const incomes = await prisma.income.findMany({
    where: { deletedAt: null },
    orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <IncomeClient incomes={incomes} />
    </div>
  );
}
