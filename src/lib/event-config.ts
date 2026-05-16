import { prisma } from "./prisma";

export type EventConfig = {
  eventDate: Date | null;
  contingencyPercent: number;
  currency: string;
  coupleNames: string | null;
  onboardingCompletedAt: Date | null;
  pixKey: string | null;
  pixKeyType: string | null;
  pixHolderName: string | null;
  pixCity: string | null;
};

export async function getEventConfig(): Promise<EventConfig> {
  const settings = await prisma.eventSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      contingencyPercent: 10,
      currency: "BRL",
    },
  });

  return {
    eventDate: settings.eventDate,
    contingencyPercent: settings.contingencyPercent,
    currency: settings.currency,
    coupleNames: settings.coupleNames,
    onboardingCompletedAt: settings.onboardingCompletedAt,
    pixKey: settings.pixKey,
    pixKeyType: settings.pixKeyType,
    pixHolderName: settings.pixHolderName,
    pixCity: settings.pixCity,
  };
}

export async function updateEventConfig(
  input: Partial<
    Omit<EventConfig, "eventDate" | "onboardingCompletedAt">
  > & {
    eventDate?: Date | null;
    onboardingCompletedAt?: Date | null;
  },
): Promise<EventConfig> {
  await getEventConfig();

  const updated = await prisma.eventSettings.update({
    where: { id: "singleton" },
    data: {
      eventDate: input.eventDate === undefined ? undefined : input.eventDate,
      contingencyPercent: input.contingencyPercent ?? undefined,
      currency: input.currency ?? undefined,
      coupleNames: input.coupleNames ?? undefined,
      onboardingCompletedAt:
        input.onboardingCompletedAt === undefined ? undefined : input.onboardingCompletedAt,
      pixKey: input.pixKey === undefined ? undefined : input.pixKey,
      pixKeyType: input.pixKeyType === undefined ? undefined : input.pixKeyType,
      pixHolderName: input.pixHolderName === undefined ? undefined : input.pixHolderName,
      pixCity: input.pixCity === undefined ? undefined : input.pixCity,
    },
  });

  return {
    eventDate: updated.eventDate,
    contingencyPercent: updated.contingencyPercent,
    currency: updated.currency,
    coupleNames: updated.coupleNames,
    onboardingCompletedAt: updated.onboardingCompletedAt,
    pixKey: updated.pixKey,
    pixKeyType: updated.pixKeyType,
    pixHolderName: updated.pixHolderName,
    pixCity: updated.pixCity,
  };
}

export function isOnboardingComplete(cfg: EventConfig): boolean {
  return Boolean(cfg.onboardingCompletedAt && cfg.eventDate && cfg.coupleNames);
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const diff = target.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
