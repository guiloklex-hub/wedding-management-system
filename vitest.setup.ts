import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
    delete: () => undefined,
  })),
}));

vi.mock("@/lib/finance-access", () => ({
  requireFinanceAccess: vi.fn().mockResolvedValue({
    user: { id: "test-user", role: "ADMIN" },
  }),
  hasFinanceAccess: vi.fn().mockResolvedValue(true),
  denyIfNoFinance: vi.fn().mockResolvedValue(null),
  denyIfNoEdit: vi.fn().mockResolvedValue(null),
  denyIfNoManage: vi.fn().mockResolvedValue(null),
}));

afterEach(async () => {
  cleanup();
  const { prisma } = await import("@/lib/prisma");
  mockReset(prisma);
  vi.clearAllMocks();
});

export {};
