import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const saveUploadMock = vi.fn();
const removeUploadMock = vi.fn();
vi.mock("@/lib/storage", () => ({
  saveUpload: (...args: unknown[]) => saveUploadMock(...args),
  removeUpload: (path: string) => removeUploadMock(path),
}));

import { deleteAttachment, uploadAttachment } from "./attachmentActions";

beforeEach(() => {
  authMock.mockReset();
  saveUploadMock.mockReset();
  removeUploadMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function file(name = "foo.pdf", type = "application/pdf", size = 100): File {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
}

describe("uploadAttachment", () => {
  it("rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const fd = new FormData();
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita quando arquivo está ausente ou vazio", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const fd = new FormData();
    fd.set("ownerType", "VENDOR");
    fd.set("ownerId", "v1");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/arquivo/i);
  });

  it("rejeita ownerType fora do enum", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "PAYMENT");
    fd.set("ownerId", "x");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita kind fora do enum", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "VENDOR");
    fd.set("ownerId", "v1");
    fd.set("kind", "FOOBAR");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita quando vendor não existe", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.vendor.findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "VENDOR");
    fd.set("ownerId", "v1");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/Fornecedor/);
  });

  it("rejeita quando contract não existe", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.contract.findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "CONTRACT");
    fd.set("ownerId", "c1");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("sucesso para VENDOR — preenche vendorId no attachment", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    saveUploadMock.mockResolvedValue({
      filename: "doc.pdf",
      mimeType: "application/pdf",
      size: 100,
      storagePath: "vendor/v1/abc_doc.pdf",
    });
    prismaMock.attachment.create.mockResolvedValue({ id: "a1" } as never);

    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "VENDOR");
    fd.set("ownerId", "v1");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.attachment.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.vendorId).toBe("v1");
    expect(data.venueId).toBeNull();
    expect(data.contractId).toBeNull();
  });

  it("sucesso para CONTRACT — preenche contractId e propaga vendorId do contrato", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.contract.findFirst.mockResolvedValue({ id: "c1", vendorId: "v9" } as never);
    saveUploadMock.mockResolvedValue({
      filename: "doc.pdf",
      mimeType: "application/pdf",
      size: 100,
      storagePath: "contract/c1/abc_doc.pdf",
    });
    prismaMock.attachment.create.mockResolvedValue({ id: "a1" } as never);

    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "CONTRACT");
    fd.set("ownerId", "c1");
    fd.set("kind", "CONTRACT");
    await uploadAttachment(undefined, fd);
    const data = (prismaMock.attachment.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.contractId).toBe("c1");
    expect(data.vendorId).toBe("v9");
  });

  it("propaga erro de saveUpload (ex: tamanho ou mime)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    saveUploadMock.mockRejectedValue(new Error("Arquivo excede 10 MB."));

    const fd = new FormData();
    fd.set("file", file());
    fd.set("ownerType", "VENDOR");
    fd.set("ownerId", "v1");
    fd.set("kind", "CONTRACT");
    const r = await uploadAttachment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/10 MB/);
  });
});

describe("deleteAttachment", () => {
  it("erro quando attachment não existe", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(null);
    const r = await deleteAttachment("a1");
    expect(r.success).toBe(false);
  });

  it("soft delete + remove do storage", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a1",
      storagePath: "vendor/v1/foo.pdf",
      vendorId: "v1",
      venueId: null,
    } as never);
    prismaMock.attachment.update.mockResolvedValue({} as never);
    removeUploadMock.mockResolvedValue(undefined);

    const r = await deleteAttachment("a1");
    expect(r.success).toBe(true);
    expect(prismaMock.attachment.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(removeUploadMock).toHaveBeenCalledWith("vendor/v1/foo.pdf");
  });
});
