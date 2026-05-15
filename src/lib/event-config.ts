import { prisma } from "./prisma";

export type EventConfig = {
  eventDate: Date;
  contingencyPercent: number;
  currency: string;
  coupleNames: string | null;
};

const DEFAULT_EVENT_DATE_ISO = "2026-11-15T00:00:00.000Z";

export async function getEventConfig(): Promise<EventConfig> {
  const settings = await prisma.eventSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      eventDate: new Date(DEFAULT_EVENT_DATE_ISO),
      contingencyPercent: 10,
      currency: "BRL",
    },
  });

  return {
    eventDate: settings.eventDate,
    contingencyPercent: settings.contingencyPercent,
    currency: settings.currency,
    coupleNames: settings.coupleNames,
  };
}

export async function updateEventConfig(
  input: Partial<Omit<EventConfig, "eventDate">> & { eventDate?: Date },
): Promise<EventConfig> {
  await getEventConfig();

  const updated = await prisma.eventSettings.update({
    where: { id: "singleton" },
    data: {
      eventDate: input.eventDate ?? undefined,
      contingencyPercent: input.contingencyPercent ?? undefined,
      currency: input.currency ?? undefined,
      coupleNames: input.coupleNames ?? undefined,
    },
  });

  return {
    eventDate: updated.eventDate,
    contingencyPercent: updated.contingencyPercent,
    currency: updated.currency,
    coupleNames: updated.coupleNames,
  };
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const diff = target.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
