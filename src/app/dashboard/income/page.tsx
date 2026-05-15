import { prisma } from "@/lib/prisma";
import IncomeClient from "./income-client";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const incomes = await prisma.income.findMany({
    where: { deletedAt: null },
    orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Receitas e ganhos</h1>
        <p className="text-sm text-zinc-500">
          Renda recorrente, bônus, presentes em dinheiro e vendas pré-casamento.
        </p>
      </div>
      <IncomeClient incomes={incomes} />
    </div>
  );
}
