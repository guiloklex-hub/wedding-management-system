import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { createGuestGroup, updateGuestGroup, deleteGuestGroup } from "./guestGroupActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "test-user", role: "ADMIN" } });
});

describe("guestGroupActions", () => {
  describe("createGuestGroup", () => {
    it("cria um grupo com rsvpPin e campos opcionais", async () => {
      prismaMock.guestGroup.create.mockResolvedValue({
        id: "g1",
        name: "Família Silva",
        rsvpPin: "1234",
      } as never);

      const fd = new FormData();
      fd.append("name", "Família Silva");
      fd.append("rsvpPin", "1234");
      fd.append("contactName", "João");

      const res = await createGuestGroup(undefined, fd);
      expect(res.success).toBe(true);
      expect(prismaMock.guestGroup.create).toHaveBeenCalledWith({
        data: {
          name: "Família Silva",
          rsvpPin: "1234",
          contactName: "João",
          contactEmail: null,
          contactPhone: null,
          notes: null,
        },
      });
    });
  });

  describe("updateGuestGroup", () => {
    it("atualiza rsvpPin do grupo", async () => {
      prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => {
        prismaMock.guestGroup.updateMany.mockResolvedValue({ count: 1 } as never);
        prismaMock.guest.updateMany.mockResolvedValue({ count: 2 } as never);
        return cb(prismaMock);
      });

      const fd = new FormData();
      fd.append("id", "g1");
      fd.append("name", "Família Silva");
      fd.append("rsvpPin", "9876");

      const res = await updateGuestGroup(undefined, fd);
      expect(res.success).toBe(true);
      expect(prismaMock.guestGroup.updateMany).toHaveBeenCalledWith({
        where: { id: "g1", deletedAt: null },
        data: {
          name: "Família Silva",
          rsvpPin: "9876",
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          notes: null,
        },
      });
    });
  });

  describe("deleteGuestGroup", () => {
    it("marca o grupo como removido", async () => {
      prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { count: 0 }] as never);

      const res = await deleteGuestGroup("g1");
      expect(res.success).toBe(true);
    });
  });
});
