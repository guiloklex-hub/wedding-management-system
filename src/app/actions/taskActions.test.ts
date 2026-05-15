import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createTask,
  deleteTask,
  loadTaskTemplates,
  setTaskStatus,
  updateTask,
} from "./taskActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  prismaMock.eventSettings.upsert.mockResolvedValue({
    id: "singleton",
    eventDate: new Date("2026-11-15T00:00:00Z"),
    contingencyPercent: 10,
    currency: "BRL",
    coupleNames: null,
  } as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("title", "Comprar alianças");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createTask", () => {
  it("aplica defaults (status=TODO, priority=MEDIUM)", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1" } as never);
    await createTask(undefined, form());
    const data = (prismaMock.task.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("TODO");
    expect(data.priority).toBe("MEDIUM");
    expect(data.completedAt).toBeNull();
  });

  it("seta completedAt quando status=DONE", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1" } as never);
    await createTask(undefined, form({ status: "DONE" }));
    const data = (prismaMock.task.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it("rejeita status fora do enum", async () => {
    const r = await createTask(undefined, form({ status: "MAYBE" }));
    expect(r.success).toBe(false);
  });

  it("rejeita priority fora do enum", async () => {
    const r = await createTask(undefined, form({ priority: "MEGA" }));
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio", async () => {
    const r = await createTask(undefined, form({ title: "" }));
    expect(r.success).toBe(false);
  });

  it("converte vendorId vazio para null", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1" } as never);
    await createTask(undefined, form({ vendorId: "", venueId: "" }));
    const data = (prismaMock.task.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.vendorId).toBeNull();
    expect(data.venueId).toBeNull();
  });
});

describe("updateTask", () => {
  it("erro quando task não existe", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    const fd = form({ id: "t1" });
    const r = await updateTask(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("preserva completedAt original quando já está DONE", async () => {
    const original = new Date("2026-01-01T00:00:00Z");
    prismaMock.task.findFirst.mockResolvedValue({
      id: "t1",
      completedAt: original,
    } as never);
    prismaMock.task.update.mockResolvedValue({} as never);

    await updateTask(undefined, form({ id: "t1", status: "DONE" }));
    const data = (prismaMock.task.update.mock.calls[0][0] as { data: { completedAt: Date | null } }).data;
    expect(data.completedAt?.getTime()).toBe(original.getTime());
  });

  it("zera completedAt quando sai de DONE", async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: "t1",
      completedAt: new Date(),
    } as never);
    prismaMock.task.update.mockResolvedValue({} as never);

    await updateTask(undefined, form({ id: "t1", status: "TODO" }));
    const data = (prismaMock.task.update.mock.calls[0][0] as { data: { completedAt: Date | null } }).data;
    expect(data.completedAt).toBeNull();
  });
});

describe("setTaskStatus", () => {
  it("seta completedAt quando status=DONE", async () => {
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 } as never);
    await setTaskStatus("t1", "DONE");
    const data = (prismaMock.task.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("DONE");
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it("zera completedAt quando status!=DONE", async () => {
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 } as never);
    await setTaskStatus("t1", "TODO");
    const data = (prismaMock.task.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.completedAt).toBeNull();
  });

  it("erro quando count===0", async () => {
    prismaMock.task.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await setTaskStatus("t1", "DONE");
    expect(r.success).toBe(false);
  });
});

describe("deleteTask", () => {
  it("soft delete", async () => {
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteTask("t1");
    expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("loadTaskTemplates", () => {
  it("pula templates já existentes quando skipExisting=true", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      { templateKey: "12m-budget" },
      { templateKey: "12m-venue" },
    ] as never);
    prismaMock.task.createMany.mockResolvedValue({ count: 30 } as never);

    const r = await loadTaskTemplates(true);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.created).toBe(30);

    const data = (prismaMock.task.createMany.mock.calls[0][0] as { data: { templateKey: string }[] }).data;
    expect(data.find((t) => t.templateKey === "12m-budget")).toBeUndefined();
    expect(data.find((t) => t.templateKey === "12m-venue")).toBeUndefined();
  });

  it("ignora skipExisting=false e carrega tudo", async () => {
    prismaMock.task.findMany.mockResolvedValue([] as never);
    prismaMock.task.createMany.mockResolvedValue({ count: 32 } as never);

    await loadTaskTemplates(false);
    const data = (prismaMock.task.createMany.mock.calls[0][0] as { data: unknown[] }).data;
    expect(data.length).toBeGreaterThan(20);
  });

  it("retorna created=0 quando nada para criar", async () => {
    prismaMock.task.findMany.mockResolvedValue(
      (await import("@/lib/task-templates")).TASK_TEMPLATES.map((t) => ({ templateKey: t.key })) as never,
    );
    const r = await loadTaskTemplates(true);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.created).toBe(0);
    expect(prismaMock.task.createMany).not.toHaveBeenCalled();
  });
});
