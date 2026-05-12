'use client';

import { useState, useActionState } from 'react';
import { createVendor, updateVendorStatus } from '@/app/actions/vendorActions';
import { Plus, Loader2 } from 'lucide-react';

export default function VendorsClient({ vendors }: { vendors: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createState, createAction, isCreating] = useActionState(createVendor, undefined);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Fornecedor</span>
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs uppercase bg-zinc-900/80 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Valor Estimado/Real</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum fornecedor cadastrado.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => {
                  const budget = vendor.budgetItems[0];
                  const value = budget?.actualValue || budget?.estimatedValue || 0;
                  const isReal = !!budget?.actualValue;

                  return (
                    <tr key={vendor.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-200">{vendor.name}</td>
                      <td className="px-6 py-4">{vendor.category}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          vendor.status === 'CONTRACTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          vendor.status === 'FINALIZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {vendor.status === 'CONTRACTED' ? 'Contratado' : vendor.status === 'FINALIZED' ? 'Finalizado' : 'Em Negociação'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-300 font-medium">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-xs text-zinc-600 ml-2">({isReal ? 'Real' : 'Estimado'})</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select 
                          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 outline-none"
                          value={vendor.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            let actual = undefined;
                            if (newStatus === 'CONTRACTED' && !isReal) {
                               const val = prompt('Qual o valor real fechado no contrato? (Apenas números e ponto para centavos)');
                               if (val && !isNaN(Number(val))) {
                                 actual = Number(val);
                               }
                            }
                            await updateVendorStatus(vendor.id, newStatus, actual);
                          }}
                        >
                          <option value="NEGOTIATION">Em Negociação</option>
                          <option value="CONTRACTED">Contratado</option>
                          <option value="FINALIZED">Finalizado</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Novo Fornecedor</h2>
              <form action={(formData) => { createAction(formData); setIsModalOpen(false); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Nome</label>
                  <input type="text" name="name" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50" placeholder="Ex: Buffet Colonial" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Categoria</label>
                  <input type="text" name="category" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50" placeholder="Ex: Alimentação" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Valor Estimado (R$)</label>
                  <input type="number" step="0.01" name="estimatedValue" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50" placeholder="Ex: 15000.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                  <select name="status" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50">
                    <option value="NEGOTIATION">Em Negociação</option>
                    <option value="CONTRACTED">Contratado</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-2.5 transition-colors font-medium text-sm">Cancelar</button>
                  <button type="submit" disabled={isCreating} className="flex-1 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2.5 transition-colors font-medium text-sm disabled:opacity-50">
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
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
