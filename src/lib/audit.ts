import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RESTORE"
  | "MARK_PAID"
  | "UNDO_PAID"
  | "STATUS_CHANGE"
  | "ARCHIVE"
  | "RESET_PASSWORD"
  | "RESET_2FA"
  | "CHANGE_OWN_PASSWORD"
  | "LOGIN"
  | "ONBOARDING_COUPLE"
  | "ONBOARDING_BUDGET"
  | "ONBOARDING_FINISH"
  | "BULK_CREATE"
  | "ASSIGN_TABLE"
  | "UNASSIGN_TABLE"
  | "REORDER"
  | "RSVP_GROUP_RESPOND"
  | "MARK_PIX_RECEIVED"
  | "CONVERT_TO_FINANCE"
  | "BACKUP_EXPORT"
  | "BACKUP_RESTORE"
  | "UPLOAD"
  | "DOWNLOAD"
  | "REPLACE"
  | "SIGN"
  | "CONNECT"
  | "DISCONNECT"
  | "ENABLE_2FA"
  | "DISABLE_2FA";

export type AuditEntity =
  | "Vendor"
  | "VendorContact"
  | "VendorNote"
  | "BudgetItem"
  | "Payment"
  | "Asset"
  | "Income"
  | "SavingsGoal"
  | "EventSettings"
  | "User"
  | "SecuritySettings"
  | "SeatingTable"
  | "Guest"
  | "GuestGroup"
  | "Gift"
  | "Contract"
  | "Attachment"
  | "Task"
  | "Venue"
  | "Honeymoon"
  | "HoneymoonItem"
  | "TrousseauItem"
  | "Broadcast";

export async function audit(
  entity: AuditEntity,
  entityId: string,
  action: AuditAction,
  payload?: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  let actorId = userId ?? null;
  if (!actorId) {
    try {
      // Import dinâmico para evitar carregar `@/auth` em contextos onde ele
      // não está disponível (e.g. testes que importam o módulo isolado).
      const { auth } = await import("@/auth");
      const session = await auth();
      const id = (session?.user as { id?: string } | undefined)?.id;
      if (id) actorId = id;
    } catch {
      // auth() may fail outside request lifecycle (cron, scripts); leave userId null
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        payload: payload ? JSON.stringify(payload) : null,
        userId: actorId,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", { entity, entityId, action, err });
  }
}
