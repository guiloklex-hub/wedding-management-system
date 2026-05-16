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
  | "RSVP_GROUP_RESPOND"
  | "MARK_PIX_RECEIVED"
  | "BACKUP_EXPORT";

export type AuditEntity =
  | "Vendor"
  | "BudgetItem"
  | "Payment"
  | "Asset"
  | "EventSettings"
  | "User"
  | "SecuritySettings"
  | "SeatingTable"
  | "Guest"
  | "GuestGroup"
  | "Gift";

export async function audit(
  entity: AuditEntity,
  entityId: string,
  action: AuditAction,
  payload?: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        payload: payload ? JSON.stringify(payload) : null,
        userId: userId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", { entity, entityId, action, err });
  }
}
