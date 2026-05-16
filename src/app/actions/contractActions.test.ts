import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const saveUploadMock = vi.fn();
vi.mock("@/lib/storage", () => ({
  saveUpload: (...args: unknown[]) => saveUploadMock(...args),
}));

import {
  createContract,
  deleteContract,
  replaceContractFile,
  updateContract,
} from "./contractActions";

beforeEach(() => {
  authMock.mockReset();
  saveUploadMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function contractForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("vendorId", "v1");
  fd.set("title", "Contrato Buffet");
  fd.set("status", "DRAFT");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createContract", () => {
  it("calcula version = existingCount + 1", async () => {
    prismaMock.contract.count.mockResolvedValue(2);
    prismaMock.contract.create.mockResolvedValue({ id: "c3" } as never);

    const r = await createContract(undefined, contractForm());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.id).toBe("c3");
    const data = (prismaMock.contract.create.mock.calls[0][0] as { data: { version: number } }).data;
    expect(data.version).toBe(3);
  });

  it("primeira versão é 1", async () => {
    prismaMock.contract.count.mockResolvedValue(0);
    prismaMock.contract.create.mockResolvedValue({ id: "c1" } as never);

    await createContract(undefined, contractForm());
    const data = (prismaMock.contract.create.mock.calls[0][0] as { data: { version: number } }).data;
    expect(data.version).toBe(1);
  });

  it("rejeita status fora do enum", async () => {
    const r = await createContract(undefined, contractForm({ status: "FOOBAR" }));
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio", async () => {
    const r = await createContract(undefined, contractForm({ title: "" }));
    expect(r.success).toBe(false);
  });
});

describe("updateContract", () => {
  it("escopado por vendorId + id + deletedAt null", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 } as never);
    const fd = contractForm({ id: "c1" });
    await updateContract(undefined, fd);
    expect(prismaMock.contract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", vendorId: "v1", deletedAt: null },
      }),
    );
  });

  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = contractForm({ id: "c1" });
    const r = await updateContract(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteContract", () => {
  it("escopado por vendorId no soft delete", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteContract("c1", "v1");
    expect(prismaMock.contract.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", vendorId: "v1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("replaceContractFile", () => {
  function pdfFile(name = "contrato.pdf"): File {
    const header = Buffer.from("%PDF-1.4\nconteudo de teste", "ascii");
    return new File([header], name, { type: "application/pdf" });
  }

  function fdWith(file: File): FormData {
    const fd = new FormData();
    fd.set("contractId", "c1");
    fd.set("vendorId", "v1");
    fd.set("file", file);
    return fd;
  }

  function setupTransaction(): void {
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return arg;
    });
  }

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    saveUploadMock.mockResolvedValue({
      filename: "contrato.pdf",
      mimeType: "application/pdf",
      size: 1024,
      storagePath: "uploads/contract/c1/v1/abc_contrato.pdf",
      sha256Full: "a".repeat(64),
    });
    prismaMock.attachment.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.attachment.create.mockResolvedValue({ id: "att1" } as never);
    prismaMock.contract.update.mockResolvedValue({} as never);
    setupTransaction();
  });

  it("primeiro upload mantém a versão atual do contrato (v1 → v1)", async () => {
    prismaMock.contract.findFirst.mockResolvedValue({
      id: "c1",
      vendorId: "v1",
      version: 1,
    } as never);
    prismaMock.attachment.count.mockResolvedValue(0 as never);

    const r = await replaceContractFile(undefined, fdWith(pdfFile()));
    expect(r.success).toBe(true);

    expect(prismaMock.contract.update).not.toHaveBeenCalled();
    expect(prismaMock.attachment.updateMany).not.toHaveBeenCalled();

    const subdir = (saveUploadMock.mock.calls[0][1] as { subdir: string }).subdir;
    expect(subdir).toBe("v1");

    const createdVersion = (
      prismaMock.attachment.create.mock.calls[0][0] as { data: { version: number } }
    ).data.version;
    expect(createdVersion).toBe(1);
  });

  it("substituição com PDF existente incrementa para v2", async () => {
    prismaMock.contract.findFirst.mockResolvedValue({
      id: "c1",
      vendorId: "v1",
      version: 1,
    } as never);
    prismaMock.attachment.count.mockResolvedValue(1 as never);
    prismaMock.attachment.updateMany.mockResolvedValue({ count: 1 } as never);

    const r = await replaceContractFile(undefined, fdWith(pdfFile()));
    expect(r.success).toBe(true);

    expect(prismaMock.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contractId: "c1", kind: "CONTRACT", deletedAt: null }),
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(prismaMock.contract.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { version: 2 },
    });

    const subdir = (saveUploadMock.mock.calls[0][1] as { subdir: string }).subdir;
    expect(subdir).toBe("v2");
  });
});
