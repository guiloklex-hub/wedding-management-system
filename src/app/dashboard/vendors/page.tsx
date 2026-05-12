import { PrismaClient } from '@prisma/client';
import VendorsClient from './vendors-client';

const prisma = new PrismaClient();

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { budgetItems: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Fornecedores</h1>
      </div>
      <VendorsClient vendors={vendors} />
    </div>
  );
}
