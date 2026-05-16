import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const readUploadMock = vi.fn();
vi.mock("@/lib/storage", () => ({
  readUpload: (path: string) => readUploadMock(path),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  readUploadMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const ADMIN = { user: { id: "u1", role: "ADMIN" } };
const VIEWER = { user: { id: "u2", role: "VIEWER" } };

describe("GET /api/files/[id]", () => {
  it("retorna 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando attachment não existe", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(404);
  });

  it("retorna 403 para VIEWER tentando ver CONTRACT", async () => {
    authMock.mockResolvedValue(VIEWER);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a1",
      kind: "CONTRACT",
      mimeType: "application/pdf",
      filename: "c.pdf",
      storagePath: "contract/c1/v1/c.pdf",
      deletedAt: null,
    } as never);
    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando readUpload falha (ENOENT/etc.)", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a1",
      kind: "PHOTO",
      storagePath: "vendor/v1/foo.png",
      mimeType: "image/png",
      filename: "foo.png",
      deletedAt: null,
    } as never);
    readUploadMock.mockRejectedValue(new Error("ENOENT"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(404);
  });

  it("PDF de contrato retorna disposição inline e headers de segurança", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a1",
      kind: "CONTRACT",
      storagePath: "contract/c1/v1/contrato.pdf",
      mimeType: "application/pdf",
      filename: "contrato.pdf",
      deletedAt: null,
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("PDFCONTENT"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="contrato.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("imagem retorna disposição inline", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a2",
      kind: "PHOTO",
      storagePath: "vendor/v1/foto.png",
      mimeType: "image/png",
      filename: "foto.png",
      deletedAt: null,
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("PNG"));

    const res = await GET(new Request("http://x/api/files/a2"), paramsFor("a2"));
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it("outros mimetypes retornam disposição attachment", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a3",
      kind: "OTHER",
      storagePath: "vendor/v1/x.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "x.docx",
      deletedAt: null,
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("DOCX"));

    const res = await GET(new Request("http://x/api/files/a3"), paramsFor("a3"));
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });

  it("body contém os bytes lidos do storage", async () => {
    authMock.mockResolvedValue(ADMIN);
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "a1",
      kind: "CONTRACT",
      storagePath: "contract/c1/v1/foo.pdf",
      mimeType: "application/pdf",
      filename: "foo.pdf",
      deletedAt: null,
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("HELLO"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    const body = await res.arrayBuffer();
    expect(new TextDecoder().decode(body)).toBe("HELLO");
  });
});
