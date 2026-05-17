import { ReactNode } from "react";
import { Sidebar } from "./_components/nav";
import { MobileNav, MobileTopBar } from "./_components/mobile-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-10">{children}</div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
