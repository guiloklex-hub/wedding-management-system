import { PrismaClient } from "@prisma/client";

const SOFT_DELETE_MODELS = new Set<string>([
  "Vendor",
  "VendorContact",
  "VendorNote",
  "Contract",
  "Attachment",
  "Venue",
  "BudgetItem",
  "Payment",
  "Asset",
  "Income",
  "SavingsGoal",
  "HoneymoonItem",
  "TrousseauItem",
  "Guest",
  "Gift",
  "Task",
  "SeatingTable",
  "GuestGroup",
]);

function modelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function injectDeletedAtFilter<T extends Record<string, unknown> | undefined>(where: T): T {
  if (where && Object.prototype.hasOwnProperty.call(where, "deletedAt")) {
    return where;
  }
  return { ...(where ?? {}), deletedAt: null } as unknown as T;
}

function createExtendedClient() {
  const base = new PrismaClient();

  // Reference holder so the delete-hook can call .update on the extended client
  // without infinite recursion (update is not intercepted).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extendedRef: { current: any } = { current: null };

  const extended = base.$extends({
    name: "softDelete",
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (
            SOFT_DELETE_MODELS.has(model) &&
            result &&
            (result as { deletedAt?: Date | null }).deletedAt !== null &&
            (result as { deletedAt?: Date | null }).deletedAt !== undefined
          ) {
            return null;
          }
          return result;
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args);
          if (
            SOFT_DELETE_MODELS.has(model) &&
            result &&
            (result as { deletedAt?: Date | null }).deletedAt !== null &&
            (result as { deletedAt?: Date | null }).deletedAt !== undefined
          ) {
            throw new Error(`No ${model} found (soft-deleted)`);
          }
          return result;
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = injectDeletedAtFilter(args.where);
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (extendedRef.current as any)[modelKey(model)].update({
              where: args.where,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (extendedRef.current as any)[modelKey(model)].updateMany({
              where: args.where,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
      },
    },
  });

  extendedRef.current = extended;
  return extended;
}

type ExtendedClient = ReturnType<typeof createExtendedClient>;
const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedClient;
  pragmaApplied?: boolean;
};

export const prisma: ExtendedClient = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.pragmaApplied) {
  globalForPrisma.pragmaApplied = true;
  void (async () => {
    try {
      await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
      await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000");
    } catch (err) {
      console.error("[prisma] failed to apply PRAGMA WAL/busy_timeout:", err);
    }
  })();
}
