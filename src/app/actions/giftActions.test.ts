import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  convertGiftCashToIncomeOrAsset,
  createGift,
  deleteGift,
  markGiftAsPixReceived,
  markGiftThanked,
  updateGift,
} from "./giftActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function setupTransaction() {
  prismaMock.$transaction.mockImplementation(async (fnOrArr: unknown) => {
    if (typeof fnOrArr === "function") {
      return (fnOrArr as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return [];
  });
}

const cashGift = {
  id: "g1",
  guestId: null,
  giverName: "Tia Ana",
  type: "CASH",
  amount: 300,
  description: null,
  status: "RECEIVED",
  receivedAt: new Date("2026-01-01T00:00:00.000Z"),
  thankedAt: null,
  isHoneymoonShare: false,
  pixPaidAt: null,
  processedAt: null,
  notes: null,
};

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

describe("convertGiftCashToIncomeOrAsset", () => {
  it("rejeita presente que não é CASH", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift, type: "ITEM", amount: null } as never);
    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "INCOME", title: "Presente" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita valor <= 0", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift, amount: 0 } as never);
    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "INCOME", title: "Presente" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita presente já lançado (processedAt setado)", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift, processedAt: new Date() } as never);
    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "ASSET", title: "Presente" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita título vazio (Zod)", async () => {
    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "INCOME", title: "  " });
    expect(r.success).toBe(false);
    expect(prismaMock.gift.findFirst).not.toHaveBeenCalled();
  });

  it("cria Income com fonte GIFT e marca processedAt atomicamente", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift } as never);
    prismaMock.gift.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.income.create.mockResolvedValue({ id: "inc1" } as never);
    setupTransaction();

    const r = await convertGiftCashToIncomeOrAsset({
      giftId: "g1",
      recordType: "INCOME",
      title: "Presente da Tia Ana",
      date: "2026-02-10",
    });

    expect(r.success).toBe(true);
    const claim = prismaMock.gift.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(claim.where).toMatchObject({ id: "g1", deletedAt: null, processedAt: null });
    expect(claim.data.processedAt).toBeInstanceOf(Date);

    const incomeData = (prismaMock.income.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(incomeData.source).toBe("GIFT");
    expect(incomeData.status).toBe("RECEIVED");
    expect(incomeData.amount).toBe(300);
    expect(incomeData.givenByName).toBe("Tia Ana");
    expect(incomeData.receivedAt).toBeInstanceOf(Date);
    expect(prismaMock.asset.create).not.toHaveBeenCalled();
  });

  it("cria Asset quando recordType=ASSET", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift } as never);
    prismaMock.gift.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.asset.create.mockResolvedValue({ id: "a1" } as never);
    setupTransaction();

    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "ASSET", title: "Caixa" });
    expect(r.success).toBe(true);
    const assetData = (prismaMock.asset.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(assetData.amount).toBe(300);
    expect(assetData.date).toBeInstanceOf(Date);
    expect(prismaMock.income.create).not.toHaveBeenCalled();
  });

  it("falha (corrida) quando o claim atômico retorna count 0", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift } as never);
    prismaMock.gift.updateMany.mockResolvedValue({ count: 0 } as never);
    setupTransaction();

    const r = await convertGiftCashToIncomeOrAsset({ giftId: "g1", recordType: "INCOME", title: "Presente" });
    expect(r.success).toBe(false);
    expect(prismaMock.income.create).not.toHaveBeenCalled();
  });
});

describe("markGiftAsPixReceived — guarda anti dupla contagem", () => {
  it("não cria Asset quando o presente já foi lançado, mas seta pixPaidAt", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift, processedAt: new Date() } as never);
    prismaMock.gift.update.mockResolvedValue({} as never);
    setupTransaction();

    const r = await markGiftAsPixReceived("g1", true);
    expect(r.success).toBe(true);
    expect(prismaMock.asset.create).not.toHaveBeenCalled();
    const updateData = (prismaMock.gift.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(updateData.pixPaidAt).toBeInstanceOf(Date);
    expect(updateData.processedAt).toBeUndefined();
  });

  it("cria Asset e seta processedAt quando ainda não processado", async () => {
    prismaMock.gift.findFirst.mockResolvedValue({ ...cashGift } as never);
    prismaMock.gift.update.mockResolvedValue({} as never);
    prismaMock.asset.create.mockResolvedValue({ id: "a1" } as never);
    setupTransaction();

    const r = await markGiftAsPixReceived("g1", true);
    expect(r.success).toBe(true);
    expect(prismaMock.asset.create).toHaveBeenCalledTimes(1);
    const updateData = (prismaMock.gift.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(updateData.processedAt).toBeInstanceOf(Date);
  });
});
