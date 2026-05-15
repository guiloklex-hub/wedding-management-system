import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createGift,
  deleteGift,
  markGiftThanked,
  updateGift,
} from "./giftActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createGift", () => {
  it("salva CASH com amount default 0 quando não informado", async () => {
    prismaMock.gift.create.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("type", "CASH");
    const r = await createGift(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.gift.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.amount).toBe(0);
    expect(data.type).toBe("CASH");
  });

  it("salva ITEM com amount opcional null", async () => {
    prismaMock.gift.create.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("type", "ITEM");
    fd.set("description", "Jogo de panelas");
    const r = await createGift(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.gift.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.amount).toBeNull();
  });

  it("usa receivedAt agora quando não informado", async () => {
    prismaMock.gift.create.mockResolvedValue({} as never);
    const before = Date.now();
    await createGift(undefined, new FormData());
    const after = Date.now();
    const data = (prismaMock.gift.create.mock.calls[0][0] as { data: { receivedAt: Date } }).data;
    expect(data.receivedAt).toBeInstanceOf(Date);
    expect(data.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.receivedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("updateGift", () => {
  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.gift.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = new FormData();
    fd.set("id", "g1");
    fd.set("type", "CASH");
    const r = await updateGift(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("markGiftThanked", () => {
  it("marca THANKED e seta thankedAt", async () => {
    prismaMock.gift.updateMany.mockResolvedValue({ count: 1 } as never);
    await markGiftThanked("g1", true);
    const data = (prismaMock.gift.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("THANKED");
    expect(data.thankedAt).toBeInstanceOf(Date);
  });

  it("volta a RECEIVED e zera thankedAt", async () => {
    prismaMock.gift.updateMany.mockResolvedValue({ count: 1 } as never);
    await markGiftThanked("g1", false);
    const data = (prismaMock.gift.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("RECEIVED");
    expect(data.thankedAt).toBeNull();
  });
});

describe("deleteGift", () => {
  it("soft delete", async () => {
    prismaMock.gift.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteGift("g1");
    expect(prismaMock.gift.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
