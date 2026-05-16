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
});

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/files/[id]", () => {
  it("retorna 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando attachment não existe", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue(null);

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(404);
  });

  it("retorna 404 quando readUpload falha (ENOENT/etc.)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a1",
      storagePath: "vendor/v1/foo.pdf",
      mimeType: "application/pdf",
      filename: "foo.pdf",
    } as never);
    readUploadMock.mockRejectedValue(new Error("ENOENT"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(404);
  });

  it("PDF retorna disposição inline", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a1",
      storagePath: "vendor/v1/foo.pdf",
      mimeType: "application/pdf",
      filename: "contrato.pdf",
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("PDFCONTENT"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="contrato.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("imagem retorna disposição inline", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a2",
      storagePath: "vendor/v1/foto.png",
      mimeType: "image/png",
      filename: "foto.png",
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("PNG"));

    const res = await GET(new Request("http://x/api/files/a2"), paramsFor("a2"));
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it("outros mimetypes retornam disposição attachment", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a3",
      storagePath: "vendor/v1/x.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "x.docx",
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("DOCX"));

    const res = await GET(new Request("http://x/api/files/a3"), paramsFor("a3"));
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });

  it("body contém os bytes lidos do storage", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: "a1",
      storagePath: "vendor/v1/foo.pdf",
      mimeType: "application/pdf",
      filename: "foo.pdf",
    } as never);
    readUploadMock.mockResolvedValue(Buffer.from("HELLO"));

    const res = await GET(new Request("http://x/api/files/a1"), paramsFor("a1"));
    const body = await res.arrayBuffer();
    expect(new TextDecoder().decode(body)).toBe("HELLO");
  });
});
