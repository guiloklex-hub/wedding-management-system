"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { Circle, GripVertical, RectangleVertical, Square, Trash2, Edit3 } from "lucide-react";
import type { ReactNode } from "react";

type Shape = "ROUND" | "RECT" | "SQUARE";

export function TableCard({
  id,
  name,
  capacity,
  shape,
  seatsUsed,
  children,
  onEdit,
  onDelete,
}: {
  id: string;
  name: string;
  capacity: number;
  shape: Shape;
  seatsUsed: number;
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("dashboard.weddingDay.seating");
  const {
    setNodeRef: setSortableRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "table-sort", tableId: id } });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `table:${id}`,
    data: { type: "table", tableId: id, capacity },
  });

  const setRefs = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const full = seatsUsed >= capacity;
  const ShapeIcon = shape === "ROUND" ? Circle : shape === "RECT" ? RectangleVertical : Square;

  return (
    <div
      ref={setRefs}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex min-h-32 flex-col rounded-2xl border bg-zinc-900/60 p-3 transition ${
        isDragging ? "opacity-40" : ""
      } ${
        isOver
          ? full
            ? "border-rose-500 bg-rose-500/5"
            : "border-emerald-500 bg-emerald-500/5"
          : "border-zinc-700"
      }`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t("card.reorderAria")}
            className="flex-none cursor-grab touch-none rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <ShapeIcon className="h-4 w-4 flex-none text-zinc-400" />
          <span className="truncate text-sm font-medium text-zinc-100">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              full
                ? "bg-rose-500/20 text-rose-300"
                : seatsUsed > 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {seatsUsed}/{capacity}
          </span>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("card.editAria")}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("card.deleteAria")}
              className="rounded p-1 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </header>
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  );
}
