import { PrismaClient } from '@prisma/client';
import PaymentsClient from './payments-client';

const prisma = new PrismaClient();

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: { vendor: true },
    orderBy: { dueDate: 'asc' }
  });
  
  const vendors = await prisma.vendor.findMany({
    where: { status: { in: ['CONTRACTED', 'FINALIZED'] } }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Pagamentos</h1>
      </div>
      <PaymentsClient payments={payments} vendors={vendors} />
    </div>
  );
}
