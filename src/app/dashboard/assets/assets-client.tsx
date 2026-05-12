'use client';

import { useState, useActionState, useEffect } from 'react';
import { createAsset } from '@/app/actions/assetActions';
import { Plus, Loader2 } from 'lucide-react';

export default function AssetsClient({ assets }: { assets: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createState, createAction, isCreating] = useActionState(createAsset, undefined);

  useEffect(() => {
    if (createState && createState.error) {
      alert(createState.error);
    }
  }, [createState]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Aporte</span>
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs uppercase bg-zinc-900/80 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Data do Aporte</th>
                <th className="px-6 py-4 font-medium">Título</th>
                <th className="px-6 py-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum aporte registrado.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  return (
                    <tr key={asset.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 text-zinc-200">{new Date(asset.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td className="px-6 py-4">{asset.title}</td>
                      <td className="px-6 py-4 font-medium text-emerald-400">
                        R$ {asset.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              <h2 className="text-xl font-bold text-white mb-4">Novo Aporte de Caixa</h2>
              <form action={(formData) => { createAction(formData); setIsModalOpen(false); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Título / Origem</label>
                  <input type="text" name="title" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50" placeholder="Ex: Salário de Março" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Valor do Aporte (R$)</label>
                  <input type="number" step="0.01" name="amount" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Data</label>
                  <input type="date" name="date" required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-2.5 transition-colors font-medium text-sm">Cancelar</button>
                  <button type="submit" disabled={isCreating} className="flex-1 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 transition-colors font-medium text-sm disabled:opacity-50">
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
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
