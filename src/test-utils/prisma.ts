import type { DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
