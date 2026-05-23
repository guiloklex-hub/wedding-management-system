import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { BackupPayload } from "./backup";

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "expiresAt",
  "signedAt",
  "dueDate",
  "paidAt",
  "expectedDate",
  "receivedAt",
  "date",
  "startDate",
  "endDate",
  "startAt",
  "endAt",
  "deadline",
  "completedAt",
  "thankedAt",
  "pixPaidAt",
  "checkedInAt",
  "visitedAt",
  "eventDate",
  "rsvpRespondedAt",
  "rsvpTokenExpiresAt",
  "onboardingCompletedAt",
  "lastLoginAt",
  "passwordUpdatedAt",
  "archivedAt",
  "twoFactorUpdatedAt",
]);

function reviveDates<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && DATE_FIELDS.has(key)) {
      const d = new Date(value);
      out[key] = Number.isNaN(d.getTime()) ? value : d;
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function rows<T extends Record<string, unknown>>(arr: ReadonlyArray<T>): T[] {
  return arr.map((r) => reviveDates(r));
}

export type RestoreOptions = {
  protectUserId?: string;
};

export type RestoreCounts = Record<string, number>;

export async function restoreBackup(
  payload: BackupPayload,
  options: RestoreOptions = {},
): Promise<RestoreCounts> {
  const counts: RestoreCounts = {};

  await prisma.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany({});
      await tx.notificationLog.deleteMany({});
      await tx.passwordResetToken.deleteMany({});
      await tx.attachment.deleteMany({});
      await tx.contract.deleteMany({});
      await tx.vendorNote.deleteMany({});
      await tx.vendorContact.deleteMany({});
      await tx.venueChecklistItem.deleteMany({});
      await tx.honeymoonItem.deleteMany({});
      await tx.payment.deleteMany({});
      await tx.gift.deleteMany({});
      await tx.task.deleteMany({});
      await tx.budgetItem.deleteMany({});
      await tx.asset.deleteMany({});
      await tx.guest.deleteMany({});
      await tx.guestGroup.deleteMany({});
      await tx.seatingTable.deleteMany({});
      await tx.income.deleteMany({});
      await tx.trousseauItem.deleteMany({});
      await tx.savingsGoal.deleteMany({});
      await tx.vendor.deleteMany({});
      await tx.venue.deleteMany({});
      await tx.honeymoon.deleteMany({});

      const replaceUsers =
        Array.isArray(payload.users) && payload.users.length > 0;
      if (replaceUsers) {
        const protect = options.protectUserId;
        await tx.user.deleteMany({
          where: protect ? { NOT: { id: protect } } : undefined,
        });
      }

      if (payload.eventSettings) {
        const data = reviveDates(payload.eventSettings as Record<string, unknown>);
        await tx.eventSettings.upsert({
          where: { id: "singleton" },
          create: data as unknown as Prisma.EventSettingsCreateInput,
          update: data as unknown as Prisma.EventSettingsUpdateInput,
        });
        counts.eventSettings = 1;
      }

      if (payload.securitySettings) {
        const data = reviveDates(payload.securitySettings as Record<string, unknown>);
        await tx.securitySettings.upsert({
          where: { id: "singleton" },
          create: data as unknown as Prisma.SecuritySettingsCreateInput,
          update: data as unknown as Prisma.SecuritySettingsUpdateInput,
        });
        counts.securitySettings = 1;
      }

      if (replaceUsers && payload.users) {
        const usersToCreate = rows(payload.users).filter(
          (u) => !options.protectUserId || u.id !== options.protectUserId,
        );
        if (usersToCreate.length > 0) {
          await tx.user.createMany({
            data: usersToCreate as unknown as Prisma.UserCreateManyInput[],
          });
        }
        counts.users = usersToCreate.length;
      }

      if (payload.savingsGoals.length) {
        await tx.savingsGoal.createMany({
          data: rows(payload.savingsGoals) as unknown as Prisma.SavingsGoalCreateManyInput[],
        });
        counts.savingsGoals = payload.savingsGoals.length;
      }

      if (payload.vendors.length) {
        await tx.vendor.createMany({
          data: rows(payload.vendors) as unknown as Prisma.VendorCreateManyInput[],
        });
        counts.vendors = payload.vendors.length;
      }

      if (payload.venues.length) {
        await tx.venue.createMany({
          data: rows(payload.venues) as unknown as Prisma.VenueCreateManyInput[],
        });
        counts.venues = payload.venues.length;
      }

      if (payload.seatingTables.length) {
        await tx.seatingTable.createMany({
          data: rows(payload.seatingTables) as unknown as Prisma.SeatingTableCreateManyInput[],
        });
        counts.seatingTables = payload.seatingTables.length;
      }

      if (payload.guestGroups.length) {
        await tx.guestGroup.createMany({
          data: rows(payload.guestGroups) as unknown as Prisma.GuestGroupCreateManyInput[],
        });
        counts.guestGroups = payload.guestGroups.length;
      }

      if (payload.honeymoon) {
        const data = reviveDates(payload.honeymoon as Record<string, unknown>);
        await tx.honeymoon.create({
          data: data as unknown as Prisma.HoneymoonCreateInput,
        });
        counts.honeymoon = 1;
      }

      if (payload.incomes.length) {
        await tx.income.createMany({
          data: rows(payload.incomes) as unknown as Prisma.IncomeCreateManyInput[],
        });
        counts.incomes = payload.incomes.length;
      }

      if (payload.trousseauItems.length) {
        await tx.trousseauItem.createMany({
          data: rows(payload.trousseauItems) as unknown as Prisma.TrousseauItemCreateManyInput[],
        });
        counts.trousseauItems = payload.trousseauItems.length;
      }

      if (payload.assets.length) {
        await tx.asset.createMany({
          data: rows(payload.assets) as unknown as Prisma.AssetCreateManyInput[],
        });
        counts.assets = payload.assets.length;
      }

      if (payload.guests.length) {
        await tx.guest.createMany({
          data: rows(payload.guests) as unknown as Prisma.GuestCreateManyInput[],
        });
        counts.guests = payload.guests.length;
      }

      if (payload.budgetItems.length) {
        await tx.budgetItem.createMany({
          data: rows(payload.budgetItems) as unknown as Prisma.BudgetItemCreateManyInput[],
        });
        counts.budgetItems = payload.budgetItems.length;
      }

      if (payload.vendorContacts.length) {
        await tx.vendorContact.createMany({
          data: rows(payload.vendorContacts) as unknown as Prisma.VendorContactCreateManyInput[],
        });
        counts.vendorContacts = payload.vendorContacts.length;
      }

      if (payload.vendorNotes.length) {
        await tx.vendorNote.createMany({
          data: rows(payload.vendorNotes) as unknown as Prisma.VendorNoteCreateManyInput[],
        });
        counts.vendorNotes = payload.vendorNotes.length;
      }

      if (payload.contracts.length) {
        await tx.contract.createMany({
          data: rows(payload.contracts) as unknown as Prisma.ContractCreateManyInput[],
        });
        counts.contracts = payload.contracts.length;
      }

      if (payload.venueChecklistItems.length) {
        await tx.venueChecklistItem.createMany({
          data: rows(payload.venueChecklistItems) as unknown as Prisma.VenueChecklistItemCreateManyInput[],
        });
        counts.venueChecklistItems = payload.venueChecklistItems.length;
      }

      if (payload.payments.length) {
        await tx.payment.createMany({
          data: rows(payload.payments) as unknown as Prisma.PaymentCreateManyInput[],
        });
        counts.payments = payload.payments.length;
      }

      if (payload.honeymoonItems.length) {
        await tx.honeymoonItem.createMany({
          data: rows(payload.honeymoonItems) as unknown as Prisma.HoneymoonItemCreateManyInput[],
        });
        counts.honeymoonItems = payload.honeymoonItems.length;
      }

      if (payload.gifts.length) {
        await tx.gift.createMany({
          data: rows(payload.gifts) as unknown as Prisma.GiftCreateManyInput[],
        });
        counts.gifts = payload.gifts.length;
      }

      if (payload.tasks.length) {
        await tx.task.createMany({
          data: rows(payload.tasks) as unknown as Prisma.TaskCreateManyInput[],
        });
        counts.tasks = payload.tasks.length;
      }

      if (payload.attachments.length) {
        await tx.attachment.createMany({
          data: rows(payload.attachments) as unknown as Prisma.AttachmentCreateManyInput[],
        });
        counts.attachments = payload.attachments.length;
      }

      if (payload.notificationLogs && payload.notificationLogs.length) {
        await tx.notificationLog.createMany({
          data: rows(payload.notificationLogs) as unknown as Prisma.NotificationLogCreateManyInput[],
        });
        counts.notificationLogs = payload.notificationLogs.length;
      }

      if (payload.auditLogs && payload.auditLogs.length) {
        await tx.auditLog.createMany({
          data: rows(payload.auditLogs) as unknown as Prisma.AuditLogCreateManyInput[],
        });
        counts.auditLogs = payload.auditLogs.length;
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  return counts;
}
