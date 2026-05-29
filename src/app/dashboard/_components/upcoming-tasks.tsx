import Link from "next/link";
import { ListTodo, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDateBR } from "@/lib/format";

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  HIGH: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  MEDIUM: "bg-zinc-700/50 text-zinc-200 border-zinc-700",
  LOW: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

const PRIORITY_KEYS: Record<string, string> = {
  URGENT: "urgent",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export async function UpcomingTasks({
  tasks,
  compact,
}: {
  tasks: Array<{ id: string; title: string; priority: string; deadline: Date | null }>;
  compact?: boolean;
}) {
  const tr = await getTranslations("dashboard.home");
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm${compact ? " flex flex-col lg:max-h-[380px]" : ""}`}>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{tr("upcomingTasks.title")}</h2>
        <ListTodo className="h-4 w-4 text-zinc-500" />
      </div>
      <div className={`custom-scrollbar space-y-3 overflow-y-auto pr-2${compact ? " min-h-0 flex-1" : " max-h-[300px]"}`}>
        {tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">{tr("upcomingTasks.empty")}</p>
        ) : (
          tasks.map((t) => (
            <Link
              key={t.id}
              href="/dashboard/tasks"
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-700/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-200">{t.title}</p>
                {t.deadline ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {formatDateBR(t.deadline)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-600">{tr("upcomingTasks.noDeadline")}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.MEDIUM}`}
              >
                {tr(`upcomingTasks.priority.${PRIORITY_KEYS[t.priority] ?? "medium"}`)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
