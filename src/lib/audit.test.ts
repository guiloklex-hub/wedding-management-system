import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { audit } from "./audit";

describe("audit", () => {
  it("cria entrada com entity, entityId, action e payload serializado", async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    await audit("Payment", "p1", "CREATE", { amount: 100 }, "u1");

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        entity: "Payment",
        entityId: "p1",
        action: "CREATE",
        payload: JSON.stringify({ amount: 100 }),
        userId: "u1",
      },
    });
  });

  it("aceita payload omisso (null)", async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    await audit("Vendor", "v1", "DELETE");

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        entity: "Vendor",
        entityId: "v1",
        action: "DELETE",
        payload: null,
        userId: null,
      },
    });
  });

  it("não lança quando o create falha", async () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.auditLog.create.mockRejectedValue(new Error("db down"));

    await expect(audit("Payment", "p1", "CREATE")).resolves.toBeUndefined();
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
