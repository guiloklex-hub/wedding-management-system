import { prisma } from "@/lib/prisma";
import TasksClient from "./tasks-client";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, vendors, venues] = await Promise.all([
    prisma.task.findMany({
      where: { deletedAt: null },
      include: {
        vendor: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { priority: "desc" }],
    }),
    prisma.vendor.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.venue.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Tarefas</h1>
        <p className="text-sm text-zinc-500">
          Use o template pronto de 12 meses ou crie tarefas avulsas. Exporta para o calendário.
        </p>
      </div>
      <TasksClient tasks={tasks} vendors={vendors} venues={venues} />
    </div>
  );
}
