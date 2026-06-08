"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  KanbanSquare,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createTask,
  deleteTask,
  loadTaskTemplates,
  setTaskStatus,
  updateTask,
} from "@/app/actions/taskActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { formatDateBR, toIsoDate } from "@/lib/format";
import { EVENT_PHASES, getEventPhase, eventProgress } from "@/lib/event-phases";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  status: string;
  priority: string;
  responsible: string | null;
  vendorId: string | null;
  venueId: string | null;
  templateKey: string | null;
  vendor: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
};

type RefRow = { id: string; name: string };

const STATUS_COLUMNS = [
  { key: "TODO", tone: "bg-zinc-800 text-zinc-200" },
  { key: "IN_PROGRESS", tone: "bg-sky-500/10 text-sky-300" },
  { key: "DONE", tone: "bg-emerald-500/10 text-emerald-300" },
  { key: "BLOCKED", tone: "bg-rose-500/10 text-rose-300" },
] as const;

const PRIORITY_CHIP: Record<string, string> = {
  LOW: "bg-zinc-800 text-zinc-400",
  MEDIUM: "bg-zinc-800 text-zinc-200",
  HIGH: "bg-amber-500/10 text-amber-300",
  URGENT: "bg-rose-500/15 text-rose-300",
};

type View = "list" | "kanban";

export default function TasksClient({
  tasks,
  vendors,
  venues,
  daysToEvent,
}: {
  tasks: TaskRow[];
  vendors: RefRow[];
  venues: RefRow[];
  daysToEvent: number | null;
}) {
  const t = useTranslations("dashboard.tasks");
  const tc = useTranslations("common");
  const toast = useToast();
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "week">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return tasks.filter((task) => {
      if (filter === "open") return task.status !== "DONE";
      if (filter === "overdue")
        return task.status !== "DONE" && task.deadline && new Date(task.deadline) < now;
      if (filter === "week")
        return task.status !== "DONE" && task.deadline && new Date(task.deadline) <= weekFromNow;
      return true;
    });
  }, [tasks, filter]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 20);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createTask(undefined, formData);
        if (r.success) {
          toast.success(t("toast.created"));
          setCreateOpen(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdatingBusy(true);
    startTransition(async () => {
      try {
        const r = await updateTask(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }

  function handleStatus(task: TaskRow, status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") {
    startTransition(async () => {
      const r = await setTaskStatus(task.id, status);
      if (!r.success) toast.error(t("toast.failed"), r.error);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteTask(id);
      if (r.success) {
        toast.success(t("toast.removed"));
        setDeleting(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  function handleLoadTemplates() {
    startTransition(async () => {
      const r = await loadTaskTemplates(true);
      if (r.success && r.data) {
        toast.success(
          r.data.created === 0
            ? t("toast.templatesAllExist")
            : t("toast.templatesCreated", { count: r.data.created }),
        );
      } else if (!r.success) {
        toast.error(t("toast.failed"), r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {daysToEvent !== null ? <TaskPhaseBar daysToEvent={daysToEvent} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="all">{t("filter.all")}</option>
            <option value="open">{t("filter.open")}</option>
            <option value="overdue">{t("filter.overdue")}</option>
            <option value="week">{t("filter.week")}</option>
          </select>
          <div className="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
                view === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <ListTodo className="h-4 w-4" /> {t("view.list")}
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
                view === "kanban" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <KanbanSquare className="h-4 w-4" /> {t("view.kanban")}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/calendar.ics"
            download
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            <Download className="h-4 w-4" /> {t("toolbar.exportIcs")}
          </a>
          <button
            type="button"
            onClick={handleLoadTemplates}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
          >
            <Sparkles className="h-4 w-4" /> {t("toolbar.loadTemplate")}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" /> {t("toolbar.newTask")}
          </button>
        </div>
      </div>

      {view === "list" ? (
        <>
          <ListView
            tasks={pageItems}
            onStatus={handleStatus}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </>
      ) : (
        <KanbanView
          tasks={filtered}
          onStatus={handleStatus}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      {createOpen ? (
        <TaskFormModal
          mode="create"
          vendors={vendors}
          venues={venues}
          isBusy={busy}
          onClose={() => setCreateOpen(false)}
          formAction={handleCreate}
        />
      ) : null}

      {editing ? (
        <TaskFormModal
          mode="edit"
          task={editing}
          vendors={vendors}
          venues={venues}
          isBusy={updatingBusy}
          onClose={() => setEditing(null)}
          formAction={handleUpdate}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? t("delete.titleNamed", { title: deleting.title }) : t("delete.title")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ListView({
  tasks,
  onStatus,
  onEdit,
  onDelete,
}: {
  tasks: TaskRow[];
  onStatus: (t: TaskRow, s: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const t = useTranslations("dashboard.tasks");
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
        {t("list.empty")}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <TaskRowItem key={t.id} task={t} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}

function TaskRowItem({
  task,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onStatus: (t: TaskRow, s: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const t = useTranslations("dashboard.tasks");
  const tc = useTranslations("common");
  const done = task.status === "DONE";
  const overdue = !done && task.deadline && new Date(task.deadline) < new Date();
  const priorityChip = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.MEDIUM;

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border bg-zinc-900/50 p-4 sm:flex-row sm:items-center ${
        overdue ? "border-rose-500/30" : "border-zinc-800"
      }`}
    >
      <button
        type="button"
        onClick={() => onStatus(task, done ? "TODO" : "DONE")}
        aria-label={done ? t("row.reopen") : t("row.complete")}
        className="shrink-0"
      >
        <CheckCircle2 className={`h-5 w-5 ${done ? "text-emerald-400" : "text-zinc-600"}`} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-zinc-500 line-through" : "text-zinc-100"}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {task.deadline ? (
            <span className={overdue ? "text-rose-300" : ""}>📅 {formatDateBR(task.deadline)}</span>
          ) : null}
          {task.responsible ? <span>👤 {task.responsible}</span> : null}
          {task.vendor ? <span>🛒 {task.vendor.name}</span> : null}
          {task.venue ? <span>🏛️ {task.venue.name}</span> : null}
          {task.templateKey ? <span className="opacity-60">{t("row.template")}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityChip}`}>
          {t(`priority.${task.priority}`)}
        </span>
        <StatusSelect value={task.status} onChange={(v) => onStatus(task, v)} />
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={tc("actions.edit")}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={tc("actions.delete")}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") => void;
}) {
  const t = useTranslations("dashboard.tasks");
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED")}
        className="appearance-none rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 pr-7 text-xs text-zinc-200 outline-none"
      >
        {STATUS_COLUMNS.map((s) => (
          <option key={s.key} value={s.key}>
            {t(`status.${s.key}`)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

function KanbanView({
  tasks,
  onStatus,
  onEdit,
  onDelete,
}: {
  tasks: TaskRow[];
  onStatus: (t: TaskRow, s: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const t = useTranslations("dashboard.tasks");
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {STATUS_COLUMNS.map((col) => {
        const items = tasks.filter((task) => task.status === col.key);
        return (
          <div key={col.key} className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${col.tone}`}>
                {t(`status.${col.key}`)}
              </span>
              <span className="text-[11px] text-zinc-500">{items.length}</span>
            </div>
            <div className="custom-scrollbar max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <p className="px-1 py-3 text-center text-xs text-zinc-600">{t("kanban.empty")}</p>
              ) : (
                items.map((task) => (
                  <KanbanCard key={task.id} task={task} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onStatus: (t: TaskRow, s: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED") => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const t = useTranslations("dashboard.tasks");
  const tc = useTranslations("common");
  const overdue =
    task.status !== "DONE" && task.deadline && new Date(task.deadline) < new Date();
  const priorityChip = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.MEDIUM;
  return (
    <div className={`rounded-xl border bg-zinc-950/60 p-3 ${overdue ? "border-rose-500/40" : "border-zinc-800"}`}>
      <p className="text-sm font-medium text-zinc-100">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {task.deadline ? (
          <span className={overdue ? "text-rose-300" : ""}>📅 {formatDateBR(task.deadline)}</span>
        ) : null}
        {task.responsible ? <span>👤 {task.responsible}</span> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityChip}`}>{t(`priority.${task.priority}`)}</span>
        <div className="flex items-center gap-1">
          <StatusSelect value={task.status} onChange={(v) => onStatus(task, v)} />
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={tc("actions.edit")}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label={tc("actions.delete")}
            className="rounded-lg p-1 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskFormModal({
  mode,
  task,
  vendors,
  venues,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  task?: TaskRow;
  vendors: RefRow[];
  venues: RefRow[];
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.tasks");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.createTitle") : t("form.editTitle")}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {task ? <input type="hidden" name="id" value={task.id} /> : null}
          <Field name="title" label={t("form.title")} required defaultValue={task?.title ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.description")}</label>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              defaultValue={task?.description ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              name="deadline"
              label={t("form.deadline")}
              type="date"
              defaultValue={task?.deadline ? toIsoDate(new Date(task.deadline)) : ""}
            />
            <Field
              name="responsible"
              label={t("form.responsible")}
              placeholder={t("form.responsiblePlaceholder")}
              defaultValue={task?.responsible ?? ""}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.status")}</label>
              <select
                name="status"
                defaultValue={task?.status ?? "TODO"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="TODO">{t("status.TODO")}</option>
                <option value="IN_PROGRESS">{t("status.IN_PROGRESS")}</option>
                <option value="DONE">{t("status.DONE")}</option>
                <option value="BLOCKED">{t("status.BLOCKED")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.priority")}</label>
              <select
                name="priority"
                defaultValue={task?.priority ?? "MEDIUM"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="LOW">{t("priority.LOW")}</option>
                <option value="MEDIUM">{t("priority.MEDIUM")}</option>
                <option value="HIGH">{t("priority.HIGH")}</option>
                <option value="URGENT">{t("priority.URGENT")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.vendor")} {tc("labels.optional")}</label>
              <select
                name="vendorId"
                defaultValue={task?.vendorId ?? ""}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="">—</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.venue")} {tc("labels.optional")}</label>
              <select
                name="venueId"
                defaultValue={task?.venueId ?? ""}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="">—</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {tc("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

function TaskPhaseBar({ daysToEvent }: { daysToEvent: number }) {
  const t = useTranslations("dashboard.tasks.phaseBar");
  const current = getEventPhase(daysToEvent);
  const progress = Math.round(eventProgress(daysToEvent) * 100);
  const past = current === "past";
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">{t("title")}</h2>
        <span className="text-xs text-zinc-400">
          {past ? t("past") : t("daysRemaining", { days: daysToEvent })}
        </span>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EVENT_PHASES.map((phase) => {
          const active = phase === current;
          return (
            <span
              key={phase}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
                  : "bg-zinc-800/60 text-zinc-400"
              }`}
            >
              {t(`phase.${phase}`)}
            </span>
          );
        })}
      </div>
    </section>
  );
}
