import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RESTORE"
  | "MARK_PAID"
  | "UNDO_PAID"
  | "STATUS_CHANGE";

export type AuditEntity =
  | "Vendor"
  | "BudgetItem"
  | "Payment"
  | "Asset"
  | "EventSettings";

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
