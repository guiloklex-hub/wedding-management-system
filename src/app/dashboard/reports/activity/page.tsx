import Link from "next/link";
import { ChevronLeft, Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_KEYS = new Set([
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
  "MARK_PAID",
  "UNDO_PAID",
  "STATUS_CHANGE",
  "UPLOAD",
  "DOWNLOAD",
  "REPLACE",
  "SIGN",
  "ARCHIVE",
  "RESET_PASSWORD",
  "RESET_2FA",
  "CHANGE_OWN_PASSWORD",
  "LOGIN",
  "BULK_CREATE",
  "ASSIGN_TABLE",
  "UNASSIGN_TABLE",
  "RSVP_GROUP_RESPOND",
  "MARK_PIX_RECEIVED",
  "ONBOARDING_COUPLE",
  "ONBOARDING_BUDGET",
  "ONBOARDING_FINISH",
]);

const ENTITY_KEYS = new Set([
  "Vendor",
  "Payment",
  "BudgetItem",
  "Asset",
  "EventSettings",
  "User",
  "SecuritySettings",
  "SeatingTable",
  "Guest",
  "GuestGroup",
  "Gift",
  "Contract",
  "Attachment",
]);

type SearchParams = Promise<{ entity?: string }>;

export default async function AuditTimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const t = await getTranslations("dashboard.reports.activity");
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canManageUsers(role)) {
    redirect("/dashboard/reports");
  }

  const actionLabel = (action: string) =>
    ACTION_KEYS.has(action) ? t(`action.${action}`) : action.toLowerCase();
  const entityLabel = (entity: string) =>
    ENTITY_KEYS.has(entity) ? t(`entity.${entity}`) : entity;

  const params = await searchParams;
  const entityFilter = params?.entity?.trim() || null;

  const where = entityFilter ? { entity: entityFilter } : {};
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => Boolean(id))));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const entities = Array.from(new Set(logs.map((l) => l.entity))).sort();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3" />
          {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/reports/activity"
          className={`rounded-full border px-3 py-1 text-xs ${
            !entityFilter
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t("filterAll")}
        </Link>
        {entities.map((e) => (
          <Link
            key={e}
            href={`/dashboard/reports/activity?entity=${e}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              entityFilter === e
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {entityLabel(e)}
          </Link>
        ))}
      </div>

      <ol className="space-y-3">
        {logs.length === 0 ? (
          <li className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-sm text-zinc-500">
            {t("empty")}
          </li>
        ) : (
          logs.map((log) => {
            const user = log.userId ? userMap.get(log.userId) : null;
            return (
              <li
                key={log.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200">
                    <span className="font-semibold">{user?.name || user?.email || t("systemActor")}</span>{" "}
                    {actionLabel(log.action)}{" "}
                    <span className="text-zinc-400">{entityLabel(log.entity)}</span>{" "}
                    <span className="text-xs text-zinc-500">#{log.entityId.slice(0, 8)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDateTimeBR(log.createdAt)}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}
