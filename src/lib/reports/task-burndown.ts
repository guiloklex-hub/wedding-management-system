import { isoDate } from "./formatters";

export type BurndownPoint = {
  date: string;
  ideal: number;
  actual: number;
  overdueCount: number;
};

type TaskRow = {
  status: string;
  createdAt: Date;
  deadline: Date | null;
  completedAt: Date | null;
};

function dayRange(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const limit = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor.getTime() <= limit.getTime()) {
    out.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function buildTaskBurndown(
  tasks: TaskRow[],
  eventDate: Date | null,
  today: Date = new Date(),
): BurndownPoint[] {
  if (!eventDate || tasks.length === 0) return [];

  const total = tasks.length;
  const startCandidate = tasks
    .map((t) => t.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const start = startCandidate < today ? startCandidate : today;
  const days = dayRange(start, eventDate);
  if (days.length < 2) return [];

  const todayKey = isoDate(today);
  const out: BurndownPoint[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dayKey = isoDate(day);
    const ideal = Math.max(0, total - (total * i) / (days.length - 1));

    let completedSoFar = 0;
    let overdueOnDay = 0;
    for (const t of tasks) {
      if (t.completedAt && t.completedAt <= day) completedSoFar += 1;
      else if (
        t.deadline &&
        t.deadline < day &&
        t.status !== "DONE" &&
        (!t.completedAt || t.completedAt > day)
      ) {
        overdueOnDay += 1;
      }
    }

    let actual: number;
    if (dayKey <= todayKey) {
      actual = Math.max(0, total - completedSoFar);
    } else {
      actual = Math.max(0, total - completedSoFar);
    }

    out.push({
      date: dayKey,
      ideal: Math.round(ideal * 10) / 10,
      actual,
      overdueCount: overdueOnDay,
    });
  }
  return out;
}
