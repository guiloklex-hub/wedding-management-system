import { ReactNode } from 'react';
import { Home, CreditCard, Users, LogOut, Wallet, Heart } from 'lucide-react';
import Link from 'next/link';
import { logout } from '@/app/actions/authActions';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex-col hidden md:flex">
        <div className="flex items-center space-x-3 p-6 border-b border-zinc-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <span className="font-semibold tracking-tight text-zinc-100">Wedding Finance</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 text-zinc-100 font-medium">
            <Home className="h-5 w-5 text-zinc-400" />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/vendors" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-100 transition-colors">
            <Users className="h-5 w-5" />
            <span>Fornecedores</span>
          </Link>
          <Link href="/dashboard/payments" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-100 transition-colors">
            <CreditCard className="h-5 w-5" />
            <span>Pagamentos</span>
          </Link>
          <Link href="/dashboard/assets" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-100 transition-colors">
            <Wallet className="h-5 w-5" />
            <span>Caixa</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <form action={logout}>
            <button type="submit" className="flex w-full items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors">
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
