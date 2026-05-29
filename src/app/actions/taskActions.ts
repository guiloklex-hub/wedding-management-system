"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getEventConfig } from "@/lib/event-config";
import { TASK_TEMPLATES, templateDeadline } from "@/lib/task-templates";
import { denyIfNoEdit } from "@/lib/finance-access";
import { zodErrorMessage } from "@/lib/zod-i18n";
import type { ActionResult } from "@/types";

const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]);
const TaskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const TaskBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optStr(2000),
  deadline: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  status: TaskStatusSchema.default("TODO"),
  priority: TaskPrioritySchema.default("MEDIUM"),
  responsible: optStr(40),
  vendorId: z.string().optional().transform((v) => (v && v.length > 0 ? v : null)),
  venueId: z.string().optional().transform((v) => (v && v.length > 0 ? v : null)),
});

const TaskCreateSchema = TaskBaseSchema;
const TaskUpdateSchema = TaskBaseSchema.extend({ id: z.string().min(1) });

export async function createTask(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.task");
  const data = Object.fromEntries(formData.entries());
  const parsed = TaskCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const created = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        deadline: parsed.data.deadline,
        status: parsed.data.status,
        priority: parsed.data.priority,
        responsible: parsed.data.responsible,
        vendorId: parsed.data.vendorId,
        venueId: parsed.data.venueId,
        completedAt: parsed.data.status === "DONE" ? new Date() : null,
      },
    });
    await audit("Task", created.id, "CREATE", { title: created.title, status: created.status });
    revalidatePath("/dashboard/tasks");
    return { success: true, data: { id: created.id } } as ActionResult<{ id: string }>;
  } catch (err) {
    console.error("[createTask]", err);
    return { success: false, error: t("errorCreate") };
  }
}

export async function updateTask(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.task");
  const data = Object.fromEntries(formData.entries());
  const parsed = TaskUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const existing = await prisma.task.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: t("notFound") };

    const completedAt =
      parsed.data.status === "DONE" ? existing.completedAt ?? new Date() : null;

    await prisma.task.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        deadline: parsed.data.deadline,
        status: parsed.data.status,
        priority: parsed.data.priority,
        responsible: parsed.data.responsible,
        vendorId: parsed.data.vendorId,
        venueId: parsed.data.venueId,
        completedAt,
      },
    });
    await audit("Task", parsed.data.id, "UPDATE", { status: parsed.data.status });
    revalidatePath("/dashboard/tasks");
    return { success: true };
  } catch (err) {
    console.error("[updateTask]", err);
    return { success: false, error: t("errorUpdate") };
  }
}

export async function setTaskStatus(
  taskId: string,
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED",
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.task");
  try {
    const result = await prisma.task.updateMany({
      where: { id: taskId, deletedAt: null },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("Task", taskId, "STATUS_CHANGE", { status });
    revalidatePath("/dashboard/tasks");
    return { success: true };
  } catch (err) {
    console.error("[setTaskStatus]", err);
    return { success: false, error: t("errorStatus") };
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.task");
  try {
    const result = await prisma.task.updateMany({
      where: { id: taskId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("Task", taskId, "DELETE");
    revalidatePath("/dashboard/tasks");
    return { success: true };
  } catch (err) {
    console.error("[deleteTask]", err);
    return { success: false, error: t("errorDelete") };
  }
}

export async function loadTaskTemplates(skipExisting = true): Promise<ActionResult<{ created: number }>> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.task");
  try {
    const cfg = await getEventConfig();
    if (!cfg.eventDate) {
      return {
        success: false,
        error: t("eventDateRequired"),
      };
    }
    const eventDate = cfg.eventDate;
    const existing = skipExisting
      ? new Set(
          (
            await prisma.task.findMany({
              where: { templateKey: { not: null }, deletedAt: null },
              select: { templateKey: true },
            })
          )
            .map((t) => t.templateKey)
            .filter((k): k is string => !!k),
        )
      : new Set<string>();

    const data = TASK_TEMPLATES.filter((t) => !existing.has(t.key)).map((t) => ({
      title: t.title,
      description: t.description ?? null,
      deadline: templateDeadline(eventDate, t),
      status: "TODO",
      priority: t.priority,
      responsible: t.responsible ?? null,
      templateKey: t.key,
    }));

    if (data.length === 0) return { success: true, data: { created: 0 } };

    const result = await prisma.task.createMany({ data });
    await audit("Task", "templates", "BULK_CREATE", { templates: result.count });
    revalidatePath("/dashboard/tasks");
    return { success: true, data: { created: result.count } };
  } catch (err) {
    console.error("[loadTaskTemplates]", err);
    return { success: false, error: t("errorTemplates") };
  }
}
