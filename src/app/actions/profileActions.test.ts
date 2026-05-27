import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { updateOwnEmail } from "./profileActions";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

let hash: string;

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "me" } });
  hash = await bcrypt.hash("secret", 10);
  prismaMock.user.findUnique.mockImplementation(
    ((args: { where: { id?: string; email?: string } }) => {
      const w = args.where;
      if (w.id === "me") return Promise.resolve({ id: "me", email: "old@x.com", password: hash });
      if (w.email === "taken@x.com") return Promise.resolve({ id: "other" });
      return Promise.resolve(null);
    }) as never,
  );
  prismaMock.user.update.mockResolvedValue({} as never);
});

describe("updateOwnEmail", () => {
  it("rejeita quando a senha atual está incorreta", async () => {
    const r = await updateOwnEmail(undefined, fd({ currentPassword: "wrong", email: "new@x.com" }));
    expect(r.success).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejeita quando o e-mail já pertence a outro usuário", async () => {
    const r = await updateOwnEmail(
      undefined,
      fd({ currentPassword: "secret", email: "taken@x.com" }),
    );
    expect(r.success).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("troca o e-mail com sucesso (normalizado) e registra audit", async () => {
    const r = await updateOwnEmail(undefined, fd({ currentPassword: "secret", email: "New@x.com" }));
    expect(r.success).toBe(true);
    const call = prismaMock.user.update.mock.calls[0][0] as { data: { email?: string } };
    expect(call.data.email).toBe("new@x.com");
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});
