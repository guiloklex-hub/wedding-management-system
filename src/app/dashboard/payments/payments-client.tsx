'use client';

import { useState, useActionState, useEffect } from 'react';
import { createPayment, markPaymentAsPaid, createSplitPayment } from '@/app/actions/paymentActions';
import { Plus, Loader2, CheckCircle2 } from 'lucide-react';

export default function PaymentsClient({ payments, vendors }: { payments: any[], vendors: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  
  const [createState, createAction, isCreating] = useActionState(createPayment, undefined);
  const [splitState, splitAction, isSplitting] = useActionState(createSplitPayment, undefined);

  useEffect(() => {
    if (createState?.error) alert(createState.error);
    if (splitState?.error) alert(splitState.error);
  }, [createState, splitState]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Pagamento</span>
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs uppercase bg-zinc-900/80 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Data Vencimento</th>
                <th className="px-6 py-4 font-medium">Fornecedor</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 font-medium">Método</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum pagamento cadastrado.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  return (
                    <tr key={payment.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 text-zinc-200">{new Date(payment.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td className="px-6 py-4">{payment.vendor.name}</td>
                      <td className="px-6 py-4 font-medium text-rose-400">
                        R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">{payment.method}</td>
                      <td className="px-6 py-4">
                         <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          payment.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {payment.status === 'PAID' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {payment.status === 'PENDING' && (
                          <button 
                            onClick={async () => await markPaymentAsPaid(payment.id)}
                            className="text-emerald-500 hover:text-emerald-400 transition-colors flex items-center justify-end w-full space-x-1"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Quitar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Novo Pagamento</h2>
                <label className="flex items-center space-x-2 text-sm text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={isSplit} onChange={(e) => setIsSplit(e.target.checked)} className="accent-rose-500" />
                  <span>Dividir (Entrada + Saldo)</span>
                </label>
              </div>
              
              <form action={(formData) => { 
                  if (isSplit) {
                    splitAction(formData);
                  } else {
                    createAction(formData);
                  }
                  setIsModalOpen(false); 
                }} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Fornecedor</label>
                  <select name="vendorId" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50">
                    <option value="">Selecione...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {!isSplit ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Valor da Parcela (R$)</label>
                      <input type="number" step="0.01" name="amount" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Data de Vencimento</label>
                      <input type="date" name="dueDate" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Método</label>
                      <select name="method" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50">
                        <option value="PIX">PIX</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="CREDIT">Cartão de Crédito</option>
                      </select>
                    </div>
                    <input type="hidden" name="status" value="PENDING" />
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">1. Entrada (Já Paga hoje)</h3>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Valor da Entrada (R$)</label>
                        <input type="number" step="0.01" name="depositAmount" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Método da Entrada</label>
                        <select name="depositMethod" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50">
                          <option value="PIX">PIX</option>
                          <option value="BOLETO">Boleto</option>
                          <option value="CREDIT">Cartão de Crédito</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">2. Saldo Final (Pendente)</h3>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Valor do Saldo (R$)</label>
                        <input type="number" step="0.01" name="finalAmount" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Data Vencimento Saldo</label>
                        <input type="date" name="finalDueDate" defaultValue="2026-10-31" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50" />
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-2.5 transition-colors font-medium text-sm">Cancelar</button>
                  <button type="submit" disabled={isCreating || isSplitting} className="flex-1 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2.5 transition-colors font-medium text-sm disabled:opacity-50">
                    {isCreating || isSplitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Pagamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
