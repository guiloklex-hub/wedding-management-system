"use client";

import { useDraggable } from "@dnd-kit/core";
import { Crown, Baby, User } from "lucide-react";

export type GuestChipData = {
  id: string;
  name: string;
  plusOnesConfirmed: number;
  isChild: boolean;
  isVIP: boolean;
  tableId: string | null;
  groupName: string | null;
};

export function GuestChip({ guest, compact = false }: { guest: GuestChipData; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guest:${guest.id}`,
    data: { type: "guest", guestId: guest.id, plusOnes: guest.plusOnesConfirmed },
  });

  const Icon = guest.isChild ? Baby : guest.isVIP ? Crown : User;
  const seats = 1 + (guest.plusOnesConfirmed ?? 0);

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      aria-label={`Arrastar ${guest.name}`}
      className={`flex w-full items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-left text-xs text-zinc-100 hover:border-rose-500/40 hover:bg-zinc-800 ${
        isDragging ? "opacity-40" : ""
      } ${compact ? "py-1" : ""}`}
    >
      <Icon className={`h-3.5 w-3.5 flex-none ${guest.isVIP ? "text-amber-400" : "text-zinc-400"}`} />
      <span className="flex-1 truncate">{guest.name}</span>
      {seats > 1 ? (
        <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
          +{guest.plusOnesConfirmed}
        </span>
      ) : null}
    </button>
  );
}
