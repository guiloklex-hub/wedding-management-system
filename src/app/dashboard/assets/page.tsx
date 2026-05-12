import { PrismaClient } from '@prisma/client';
import AssetsClient from './assets-client';

const prisma = new PrismaClient();

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { date: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Caixa (Dinheiro Guardado)</h1>
      </div>
      <AssetsClient assets={assets} />
    </div>
  );
}
