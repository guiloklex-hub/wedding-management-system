import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { updateUser } from "./userActions";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "me", email: "me@x.com", role: "ADMIN" } });
  prismaMock.user.findUnique.mockImplementation(
    ((args: { where: { id?: string; email?: string } }) => {
      const w = args.where;
      if (w.id === "me")
        return Promise.resolve({
          id: "me",
          email: "me@x.com",
          role: "ADMIN",
          isActive: true,
          archivedAt: null,
        });
      if (w.id === "t1")
        return Promise.resolve({
          id: "t1",
          email: "old@x.com",
          role: "GROOM",
          isActive: true,
          archivedAt: null,
        });
      if (w.email === "taken@x.com") return Promise.resolve({ id: "other" });
      return Promise.resolve(null);
    }) as never,
  );
  prismaMock.user.update.mockResolvedValue({} as never);
});

describe("updateUser — email", () => {
  it("troca o email com sucesso (normalizado para minúsculas)", async () => {
    const r = await updateUser(undefined, fd({ id: "t1", name: "Novo", email: "New@x.com" }));
    expect(r.success).toBe(true);
    const call = prismaMock.user.update.mock.calls[0][0] as { data: { email?: string } };
    expect(call.data.email).toBe("new@x.com");
  });

  it("rejeita email já usado por outro usuário e não grava", async () => {
    const r = await updateUser(undefined, fd({ id: "t1", email: "taken@x.com" }));
    expect(r.success).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("não inclui email no update quando é o mesmo do usuário", async () => {
    const r = await updateUser(undefined, fd({ id: "t1", email: "old@x.com", name: "Old" }));
    expect(r.success).toBe(true);
    const call = prismaMock.user.update.mock.calls[0][0] as { data: { email?: string } };
    expect(call.data.email).toBeUndefined();
  });
});
