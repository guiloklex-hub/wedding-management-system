"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Plus, Users, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  assignGuestToTable,
  createSeatingTable,
  deleteSeatingTable,
  reorderSeatingTables,
  updateSeatingTable,
} from "@/app/actions/seatingTableActions";
import { GuestChip, type GuestChipData } from "./_components/GuestChip";
import { TableCard } from "./_components/TableCard";

type Table = {
  id: string;
  name: string;
  capacity: number;
  shape: string;
  x: number;
  y: number;
  sortOrder: number;
  notes: string | null;
};

type Props = {
  initialTables: Table[];
  initialGuests: GuestChipData[];
};

function computeSeatsUsed(guests: GuestChipData[], tableId: string): number {
  return guests
    .filter((g) => g.tableId === tableId)
    .reduce((sum, g) => sum + 1 + (g.plusOnesConfirmed ?? 0), 0);
}

// Guests droppam em mesas/pool; mesas reordenam entre si. Filtramos os candidatos
// pelo tipo do item ativo para o `over` nunca ficar ambíguo (cada card é, ao mesmo
// tempo, um item sortable e um droppable de convidado).
const seatingCollision: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;
  if (activeType === "table-sort") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === "table-sort",
      ),
    });
  }
  return pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.type === "table" || c.data.current?.type === "pool",
    ),
  });
};

export default function SeatingClient({ initialTables, initialGuests }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [guests, setGuests] = useState<GuestChipData[]>(initialGuests);
  const [prevTablesProp, setPrevTablesProp] = useState(initialTables);
  const [prevGuestsProp, setPrevGuestsProp] = useState(initialGuests);
  if (initialTables !== prevTablesProp) {
    setPrevTablesProp(initialTables);
    setTables(initialTables);
  }
  if (initialGuests !== prevGuestsProp) {
    setPrevGuestsProp(initialGuests);
    setGuests(initialGuests);
  }
  const [activeGuest, setActiveGuest] = useState<GuestChipData | null>(null);
  const [activeTable, setActiveTable] = useState<Table | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const pool = useMemo(() => guests.filter((g) => !g.tableId), [guests]);
  const totalAllocated = useMemo(
    () => guests.filter((g) => g.tableId !== null).reduce((s, g) => s + 1 + g.plusOnesConfirmed, 0),
    [guests],
  );
  const totalSeats = useMemo(() => tables.reduce((s, t) => s + t.capacity, 0), [tables]);

  function handleDragStart(e: DragStartEvent) {
    const idStr = String(e.active.id);
    if (idStr.startsWith("guest:")) {
      const guestId = idStr.slice("guest:".length);
      const guest = guests.find((g) => g.id === guestId);
      if (guest) setActiveGuest(guest);
      return;
    }
    const table = tables.find((t) => t.id === idStr);
    if (table) setActiveTable(table);
  }

  function handleReorder(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === activeId) return;
    const oldIndex = tables.findIndex((t) => t.id === activeId);
    const newIndex = tables.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = tables;
    const reordered = arrayMove(tables, oldIndex, newIndex);
    setTables(reordered);

    startTransition(async () => {
      const res = await reorderSeatingTables(reordered.map((t) => t.id));
      if (!res.success) {
        toast.error("Falha", res.error);
        setTables(previous);
      } else {
        router.refresh();
      }
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveGuest(null);
    setActiveTable(null);
    if (e.active.data.current?.type === "table-sort") {
      handleReorder(e);
      return;
    }
    const activeId = String(e.active.id);
    if (!activeId.startsWith("guest:")) return;
    const guestId = activeId.slice("guest:".length);

    const overData = e.over?.data.current as { type?: string; tableId?: string } | undefined;
    let targetTableId: string | null | undefined = undefined;
    if (overData?.type === "table") targetTableId = overData.tableId ?? null;
    else if (overData?.type === "pool") targetTableId = null;

    if (targetTableId === undefined) return;

    const guest = guests.find((g) => g.id === guestId);
    if (!guest) return;
    if (guest.tableId === targetTableId) return;

    if (targetTableId) {
      const table = tables.find((t) => t.id === targetTableId);
      if (!table) return;
      const seatsUsed = computeSeatsUsed(
        guests.filter((g) => g.id !== guestId),
        targetTableId,
      );
      const needed = 1 + (guest.plusOnesConfirmed ?? 0);
      if (seatsUsed + needed > table.capacity) {
        toast.error(
          "Mesa cheia",
          `Capacidade ${table.capacity}, ocupados ${seatsUsed}, necessário ${needed}`,
        );
        return;
      }
    }

    const previousTableId = guest.tableId;
    setGuests((cur) => cur.map((g) => (g.id === guestId ? { ...g, tableId: targetTableId } : g)));

    startTransition(async () => {
      const res = await assignGuestToTable(guestId, targetTableId);
      if (!res.success) {
        toast.error("Falha", res.error);
        setGuests((cur) => cur.map((g) => (g.id === guestId ? { ...g, tableId: previousTableId } : g)));
      } else {
        router.refresh();
      }
    });
  }

  async function handleCreate(formData: FormData) {
    setBusy(true);
    const res = await createSeatingTable(undefined, formData);
    setBusy(false);
    if (!res.success) {
      toast.error("Erro", res.error);
      return;
    }
    toast.success("Mesa criada");
    setShowCreate(false);
    router.refresh();
  }

  async function handleEditSave(formData: FormData) {
    if (!editing) return;
    formData.append("id", editing.id);
    setBusy(true);
    const res = await updateSeatingTable(undefined, formData);
    setBusy(false);
    if (!res.success) {
      toast.error("Erro", res.error);
      return;
    }
    toast.success("Mesa atualizada");
    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await deleteSeatingTable(confirmDelete.id);
    setBusy(false);
    if (!res.success) {
      toast.error("Erro", res.error);
      return;
    }
    toast.success("Mesa excluída");
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={seatingCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 md:text-2xl">Mapa de assentos</h1>
            <p className="text-sm text-zinc-400">
              Arraste convidados confirmados para as mesas. Capacidade considera +1.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            Nova mesa
          </button>
        </header>

        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-3">
          <Stat label="Mesas" value={tables.length} />
          <Stat label="Assentos totais" value={totalSeats} />
          <Stat label="Convidados alocados" value={totalAllocated} suffix={`/${guests.reduce((s, g) => s + 1 + g.plusOnesConfirmed, 0)}`} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <GuestPool guests={pool} />

          <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
              <Info className="h-3.5 w-3.5" />
              {tables.length === 0
                ? "Crie a primeira mesa para começar."
                : "Solte um convidado numa mesa para alocar; arraste pela alça para reordenar."}
            </div>
            <SortableContext items={tables.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tables.map((t) => {
                  const tableGuests = guests.filter((g) => g.tableId === t.id);
                  const seatsUsed = computeSeatsUsed(guests, t.id);
                  return (
                    <TableCard
                      key={t.id}
                      id={t.id}
                      name={t.name}
                      capacity={t.capacity}
                      shape={t.shape as "ROUND" | "RECT" | "SQUARE"}
                      seatsUsed={seatsUsed}
                      onEdit={() => setEditing(t)}
                      onDelete={() => setConfirmDelete(t)}
                    >
                      {tableGuests.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-zinc-700 px-2 py-3 text-center text-[11px] text-zinc-500">
                          Solte convidados aqui
                        </p>
                      ) : (
                        tableGuests.map((g) => <GuestChip key={g.id} guest={g} compact />)
                      )}
                    </TableCard>
                  );
                })}
              </div>
            </SortableContext>
          </section>
        </div>

        {showCreate ? (
          <TableForm
            title="Nova mesa"
            busy={busy}
            onCancel={() => setShowCreate(false)}
            onSubmit={handleCreate}
          />
        ) : null}

        {editing ? (
          <TableForm
            title="Editar mesa"
            initial={{ name: editing.name, capacity: editing.capacity, shape: editing.shape, notes: editing.notes }}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={handleEditSave}
          />
        ) : null}

        <ConfirmDialog
          open={confirmDelete !== null}
          title="Excluir mesa?"
          description={
            confirmDelete
              ? `A mesa "${confirmDelete.name}" será removida e os convidados ficarão sem alocação.`
              : ""
          }
          tone="danger"
          confirmLabel="Excluir"
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>

      <DragOverlay>
        {activeGuest ? (
          <div className="rounded-lg border border-rose-500 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 shadow-lg">
            {activeGuest.name}
            {activeGuest.plusOnesConfirmed > 0 ? ` +${activeGuest.plusOnesConfirmed}` : ""}
          </div>
        ) : activeTable ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 shadow-2xl">
            <GripVertical className="h-4 w-4 text-zinc-500" />
            <span className="font-medium">{activeTable.name}</span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {computeSeatsUsed(guests, activeTable.id)}/{activeTable.capacity}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-100">
        {value}
        {suffix ? <span className="text-sm text-zinc-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

function GuestPool({ guests }: { guests: GuestChipData[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pool",
    data: { type: "pool" },
  });
  return (
    <aside
      ref={setNodeRef}
      className={`w-full rounded-2xl border bg-zinc-900/30 p-3 lg:w-72 ${
        isOver ? "border-amber-500 bg-amber-500/5" : "border-zinc-800"
      }`}
    >
      <header className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium text-zinc-100">Pool de convidados</h2>
        <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {guests.length}
        </span>
      </header>
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {guests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-700 px-3 py-6 text-center text-xs text-zinc-500">
            Todos os confirmados estão alocados. Solte aqui para desalocar.
          </p>
        ) : (
          guests.map((g) => <GuestChip key={g.id} guest={g} />)
        )}
      </div>
    </aside>
  );
}

function TableForm({
  title,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial?: { name: string; capacity: number; shape: string; notes: string | null };
  busy: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <form
        action={onSubmit}
        className="my-4 w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <Field label="Nome">
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            maxLength={80}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacidade">
            <input
              type="number"
              name="capacity"
              min={1}
              max={50}
              defaultValue={initial?.capacity ?? 8}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
            />
          </Field>
          <Field label="Formato">
            <select
              name="shape"
              defaultValue={initial?.shape ?? "ROUND"}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
            >
              <option value="ROUND">Redonda</option>
              <option value="RECT">Retangular</option>
              <option value="SQUARE">Quadrada</option>
            </select>
          </Field>
        </div>
        <Field label="Observações">
          <textarea
            name="notes"
            defaultValue={initial?.notes ?? ""}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

