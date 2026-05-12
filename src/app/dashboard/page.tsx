import { PrismaClient } from '@prisma/client';
import { CreditCard, Wallet, AlertCircle, CalendarClock, TrendingDown } from 'lucide-react';
import DashboardCharts from './charts';

const prisma = new PrismaClient();

export default async function DashboardPage() {
  const vendors = await prisma.vendor.findMany({
    include: { budgetItems: true, payments: true }
  });
  const assets = await prisma.asset.findMany();
  
  // Fundo de Contingência (10% do total contratado)
  const contractedVendors = vendors.filter(v => v.status === 'CONTRACTED' || v.status === 'FINALIZED');
  const totalContracted = contractedVendors.reduce((acc, v) => {
    const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue || item.estimatedValue), 0);
    return acc + cost;
  }, 0);
  const contingencyFund = totalContracted * 0.10;
  
  // Orçamento Total (Estimado + Contratado + Contingência)
  const totalBudget = vendors.reduce((acc, v) => {
    const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue || item.estimatedValue), 0);
    return acc + cost;
  }, 0) + contingencyFund;
  
  // Total Já Pago
  const payments = await prisma.payment.findMany();
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amount, 0);
  
  // Saldo Devedor Restante
  const remainingBalance = totalBudget - totalPaid;
  
  // Cobertura de Caixa
  const totalAssets = assets.reduce((acc, a) => acc + a.amount, 0);
  
  // Distribuição por Categoria
  const categoryDataMap = new Map<string, number>();
  vendors.forEach(v => {
    const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue || item.estimatedValue), 0);
    categoryDataMap.set(v.category, (categoryDataMap.get(v.category) || 0) + cost);
  });
  if (contingencyFund > 0) {
    categoryDataMap.set('Fundo de Contingência', contingencyFund);
  }
  
  const categoryData = Array.from(categoryDataMap.entries()).map(([name, value]) => ({ name, value }));

  // Próximos Vencimentos (30 dias) e Alerta de Quitação (menos de 20 dias da data do evento)
  const today = new Date();
  const next30Days = new Date(today);
  next30Days.setDate(today.getDate() + 30);
  
  const upcomingPayments = payments
    .filter(p => p.status === 'PENDING' && p.dueDate <= next30Days)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Alerta Quitação: Fornecedores com saldo pendente e faltando < 20 dias pro evento
  const eventDate = new Date('2026-11-15T00:00:00.000Z');
  const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const showQuitAlert = daysUntilEvent <= 20;

  const vendorsWithPendingPayments = vendors.filter(v => {
    const vendorPayments = payments.filter(p => p.vendorId === v.id);
    const vendorPaid = vendorPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const vendorTotal = v.budgetItems.reduce((sum, i) => sum + (i.actualValue || i.estimatedValue), 0);
    return vendorTotal > vendorPaid;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
      </div>
      
      {showQuitAlert && vendorsWithPendingPayments.length > 0 && (
        <div className="flex items-center space-x-3 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 shadow-sm backdrop-blur-sm">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Alerta de Quitação!</h3>
            <p className="text-sm">Faltam menos de 20 dias para o evento e há fornecedores com saldo devedor.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Orçamento Total" value={totalBudget} icon={<Wallet className="h-5 w-5" />} />
        <Card title="Total Já Pago" value={totalPaid} icon={<CreditCard className="h-5 w-5" />} />
        <Card title="Saldo Devedor" value={remainingBalance} icon={<TrendingDown className="h-5 w-5 text-rose-500" />} />
        <Card title="Cobertura de Caixa" value={totalAssets} icon={<Wallet className="h-5 w-5 text-emerald-500" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Distribuição */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-zinc-100">Distribuição do Orçamento</h2>
          <DashboardCharts data={categoryData} />
        </div>

        {/* Próximos Vencimentos */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">Próximos Vencimentos (30 dias)</h2>
            <CalendarClock className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {upcomingPayments.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nenhum pagamento para os próximos 30 dias.</p>
            ) : (
              upcomingPayments.map(p => {
                const vendor = vendors.find(v => v.id === p.vendorId);
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-800/50 border border-zinc-800/80 hover:bg-zinc-800 transition-colors">
                    <div>
                      <p className="font-medium text-zinc-200">{vendor?.name || 'Fornecedor'}</p>
                      <p className="text-xs text-zinc-500 mt-1">Vencimento: {new Date(p.dueDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="font-semibold text-rose-400">
                      R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm backdrop-blur-sm transition-all hover:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className="text-zinc-500 p-2 rounded-lg bg-zinc-800/50 border border-zinc-800">{icon}</div>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-bold text-zinc-100 tracking-tight">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
