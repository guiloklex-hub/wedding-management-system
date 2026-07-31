import { prisma } from "./prisma";
import { coerceLocale, type Locale } from "@/i18n/config";

export type EventConfig = {
  eventDate: Date | null;
  contingencyPercent: number;
  currency: string;
  coupleNames: string | null;
  daySchedule: string | null;
  rainPlanB: string | null;
  onboardingCompletedAt: Date | null;
  defaultLocale: Locale;
  pixKey: string | null;
  pixKeyType: string | null;
  pixHolderName: string | null;
  pixCity: string | null;
  weddingWebsiteUrl: string | null;
  giftRegistryUrl: string | null;
  saveTheDateMessage: string | null;
  saveTheDateFilePath: string | null;
  saveTheDateFileMime: string | null;
  saveTheDateFileName: string | null;
  saveTheDateExcludeTagIds: string | null;
  saveTheDateExcludePadrinhos: boolean;
  invitationMessage: string | null;
  invitationFilePath: string | null;
  invitationFileMime: string | null;
  invitationFileName: string | null;
  invitationRsvpUrl: string | null;
  invitationRsvpUseExternal: boolean;
  invitationRsvpDeadline: string | null;
  invitationExcludeTagIds: string | null;
  invitationExcludePadrinhos: boolean;
  rsvpReminderEnabled: boolean;
  rsvpReminderDays: number;
  aiEnabled: boolean;
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
    daySchedule: settings.daySchedule,
    rainPlanB: settings.rainPlanB,
    onboardingCompletedAt: settings.onboardingCompletedAt,
    defaultLocale: coerceLocale(settings.defaultLocale),
    pixKey: settings.pixKey,
    pixKeyType: settings.pixKeyType,
    pixHolderName: settings.pixHolderName,
    pixCity: settings.pixCity,
    weddingWebsiteUrl: settings.weddingWebsiteUrl,
    giftRegistryUrl: settings.giftRegistryUrl,
    saveTheDateMessage: settings.saveTheDateMessage,
    saveTheDateFilePath: settings.saveTheDateFilePath,
    saveTheDateFileMime: settings.saveTheDateFileMime,
    saveTheDateFileName: settings.saveTheDateFileName,
    saveTheDateExcludeTagIds: settings.saveTheDateExcludeTagIds,
    saveTheDateExcludePadrinhos: settings.saveTheDateExcludePadrinhos,
    invitationMessage: settings.invitationMessage,
    invitationFilePath: settings.invitationFilePath,
    invitationFileMime: settings.invitationFileMime,
    invitationFileName: settings.invitationFileName,
    invitationRsvpUrl: settings.invitationRsvpUrl,
    invitationRsvpUseExternal: settings.invitationRsvpUseExternal,
    invitationRsvpDeadline: settings.invitationRsvpDeadline,
    invitationExcludeTagIds: settings.invitationExcludeTagIds,
    invitationExcludePadrinhos: settings.invitationExcludePadrinhos,
    rsvpReminderEnabled: settings.rsvpReminderEnabled,
    rsvpReminderDays: settings.rsvpReminderDays,
    aiEnabled: settings.aiEnabled,
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
      daySchedule: input.daySchedule === undefined ? undefined : input.daySchedule,
      rainPlanB: input.rainPlanB === undefined ? undefined : input.rainPlanB,
      onboardingCompletedAt:
        input.onboardingCompletedAt === undefined ? undefined : input.onboardingCompletedAt,
      defaultLocale: input.defaultLocale ?? undefined,
      pixKey: input.pixKey === undefined ? undefined : input.pixKey,
      pixKeyType: input.pixKeyType === undefined ? undefined : input.pixKeyType,
      pixHolderName: input.pixHolderName === undefined ? undefined : input.pixHolderName,
      pixCity: input.pixCity === undefined ? undefined : input.pixCity,
      weddingWebsiteUrl:
        input.weddingWebsiteUrl === undefined ? undefined : input.weddingWebsiteUrl,
      giftRegistryUrl:
        input.giftRegistryUrl === undefined ? undefined : input.giftRegistryUrl,
      saveTheDateMessage:
        input.saveTheDateMessage === undefined ? undefined : input.saveTheDateMessage,
      saveTheDateFilePath:
        input.saveTheDateFilePath === undefined ? undefined : input.saveTheDateFilePath,
      saveTheDateFileMime:
        input.saveTheDateFileMime === undefined ? undefined : input.saveTheDateFileMime,
      saveTheDateFileName:
        input.saveTheDateFileName === undefined ? undefined : input.saveTheDateFileName,
      saveTheDateExcludeTagIds:
        input.saveTheDateExcludeTagIds === undefined ? undefined : input.saveTheDateExcludeTagIds,
      saveTheDateExcludePadrinhos:
        input.saveTheDateExcludePadrinhos === undefined
          ? undefined
          : input.saveTheDateExcludePadrinhos,
      invitationMessage:
        input.invitationMessage === undefined ? undefined : input.invitationMessage,
      invitationFilePath:
        input.invitationFilePath === undefined ? undefined : input.invitationFilePath,
      invitationFileMime:
        input.invitationFileMime === undefined ? undefined : input.invitationFileMime,
      invitationFileName:
        input.invitationFileName === undefined ? undefined : input.invitationFileName,
      invitationRsvpUrl:
        input.invitationRsvpUrl === undefined ? undefined : input.invitationRsvpUrl,
      invitationRsvpUseExternal:
        input.invitationRsvpUseExternal === undefined
          ? undefined
          : input.invitationRsvpUseExternal,
      invitationRsvpDeadline:
        input.invitationRsvpDeadline === undefined ? undefined : input.invitationRsvpDeadline,
      invitationExcludeTagIds:
        input.invitationExcludeTagIds === undefined ? undefined : input.invitationExcludeTagIds,
      invitationExcludePadrinhos:
        input.invitationExcludePadrinhos === undefined
          ? undefined
          : input.invitationExcludePadrinhos,
      rsvpReminderEnabled:
        input.rsvpReminderEnabled === undefined ? undefined : input.rsvpReminderEnabled,
      rsvpReminderDays:
        input.rsvpReminderDays === undefined ? undefined : input.rsvpReminderDays,
      aiEnabled: input.aiEnabled === undefined ? undefined : input.aiEnabled,
    },
  });

  return {
    eventDate: updated.eventDate,
    contingencyPercent: updated.contingencyPercent,
    currency: updated.currency,
    coupleNames: updated.coupleNames,
    daySchedule: updated.daySchedule,
    rainPlanB: updated.rainPlanB,
    onboardingCompletedAt: updated.onboardingCompletedAt,
    defaultLocale: coerceLocale(updated.defaultLocale),
    pixKey: updated.pixKey,
    pixKeyType: updated.pixKeyType,
    pixHolderName: updated.pixHolderName,
    pixCity: updated.pixCity,
    weddingWebsiteUrl: updated.weddingWebsiteUrl,
    giftRegistryUrl: updated.giftRegistryUrl,
    saveTheDateMessage: updated.saveTheDateMessage,
    saveTheDateFilePath: updated.saveTheDateFilePath,
    saveTheDateFileMime: updated.saveTheDateFileMime,
    saveTheDateFileName: updated.saveTheDateFileName,
    saveTheDateExcludeTagIds: updated.saveTheDateExcludeTagIds,
    saveTheDateExcludePadrinhos: updated.saveTheDateExcludePadrinhos,
    invitationMessage: updated.invitationMessage,
    invitationFilePath: updated.invitationFilePath,
    invitationFileMime: updated.invitationFileMime,
    invitationFileName: updated.invitationFileName,
    invitationRsvpUrl: updated.invitationRsvpUrl,
    invitationRsvpUseExternal: updated.invitationRsvpUseExternal,
    invitationRsvpDeadline: updated.invitationRsvpDeadline,
    invitationExcludeTagIds: updated.invitationExcludeTagIds,
    invitationExcludePadrinhos: updated.invitationExcludePadrinhos,
    rsvpReminderEnabled: updated.rsvpReminderEnabled,
    rsvpReminderDays: updated.rsvpReminderDays,
    aiEnabled: updated.aiEnabled,
  };
}

export function isOnboardingComplete(cfg: EventConfig): boolean {
  return Boolean(cfg.onboardingCompletedAt && cfg.eventDate && cfg.coupleNames);
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const diff = target.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
