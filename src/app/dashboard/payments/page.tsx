import { prisma } from "@/lib/prisma";
import PaymentsClient from "./payments-client";

export const dynamic = "force-dynamic";


export default async function PaymentsPage() {
  const [payments, vendors] = await Promise.all([
    prisma.payment.findMany({
      where: { deletedAt: null },
      include: { vendor: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.vendor.findMany({
      where: { deletedAt: null, status: { in: ["CONTRACTED", "FINALIZED"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Pagamentos</h1>
      </div>
      <PaymentsClient payments={payments} vendors={vendors} />
    </div>
  );
}
