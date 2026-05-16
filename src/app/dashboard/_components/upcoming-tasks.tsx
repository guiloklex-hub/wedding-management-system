import Link from "next/link";
import { ListTodo, Clock } from "lucide-react";
import { formatDateBR } from "@/lib/format";

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  HIGH: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  MEDIUM: "bg-zinc-700/50 text-zinc-200 border-zinc-700",
  LOW: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export function UpcomingTasks({
  tasks,
}: {
  tasks: Array<{ id: string; title: string; priority: string; deadline: Date | null }>;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Próximas Tarefas</h2>
        <ListTodo className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="custom-scrollbar max-h-[300px] space-y-3 overflow-y-auto pr-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma tarefa pendente.</p>
        ) : (
          tasks.map((t) => (
            <Link
              key={t.id}
              href="/dashboard/tasks"
              className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-700/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-200">{t.title}</p>
                {t.deadline ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {formatDateBR(t.deadline)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-600">Sem prazo</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.MEDIUM}`}
              >
                {t.priority}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
