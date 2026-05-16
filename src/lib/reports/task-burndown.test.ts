import { describe, it, expect } from "vitest";
import { buildTaskBurndown } from "./task-burndown";

describe("buildTaskBurndown", () => {
  it("retorna [] sem eventDate", () => {
    expect(buildTaskBurndown([], null)).toEqual([]);
  });

  it("retorna [] sem tasks", () => {
    expect(buildTaskBurndown([], new Date("2026-12-01"))).toEqual([]);
  });

  it("ideal começa em N e termina em 0", () => {
    const tasks = Array.from({ length: 4 }, () => ({
      status: "TODO",
      createdAt: new Date("2026-01-01"),
      deadline: null,
      completedAt: null,
    }));
    const r = buildTaskBurndown(tasks, new Date("2026-01-05"), new Date("2026-01-01"));
    expect(r[0].ideal).toBe(4);
    expect(r[r.length - 1].ideal).toBe(0);
  });

  it("real decresce conforme completadas", () => {
    const r = buildTaskBurndown(
      [
        {
          status: "DONE",
          createdAt: new Date("2026-01-01"),
          deadline: null,
          completedAt: new Date("2026-01-03"),
        },
        {
          status: "TODO",
          createdAt: new Date("2026-01-01"),
          deadline: null,
          completedAt: null,
        },
      ],
      new Date("2026-01-05"),
      new Date("2026-01-05"),
    );
    expect(r[0].actual).toBe(2);
    expect(r[r.length - 1].actual).toBe(1);
  });
});
