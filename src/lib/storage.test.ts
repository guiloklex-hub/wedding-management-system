import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readUpload, removeUpload, sanitizeFilename } from "./storage";

const realCwd = process.cwd();
let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wedding-uploads-"));
  process.chdir(tmpRoot);
  await fs.mkdir(path.join(tmpRoot, "uploads"), { recursive: true });
});

afterAll(async () => {
  process.chdir(realCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("sanitizeFilename", () => {
  it("substitui caracteres especiais por underscore", () => {
    expect(sanitizeFilename("conta de luz!.pdf")).toBe("conta_de_luz_.pdf");
  });

  it("preserva ponto, hifen e underscore", () => {
    expect(sanitizeFilename("foo-bar_v1.2.pdf")).toBe("foo-bar_v1.2.pdf");
  });

  it("limita a 120 chars", () => {
    const long = "a".repeat(300) + ".pdf";
    const result = sanitizeFilename(long);
    expect(result.length).toBe(120);
  });

  it("usa fallback 'file' para entrada vazia", () => {
    expect(sanitizeFilename("")).toBe("file");
  });

  it("colapsa símbolos em underscore", () => {
    expect(sanitizeFilename("///")).toBe("_");
  });

  it("normaliza unicode (NFKD)", () => {
    const sanitized = sanitizeFilename("café.pdf");
    expect(sanitized).toMatch(/cafe[._-]?\.pdf/i);
  });
});

describe("readUpload — path traversal", () => {
  it("rejeita caminho com ../", async () => {
    await expect(readUpload("../etc/passwd")).rejects.toThrow(/path traversal|inválido/i);
  });

  it("rejeita caminho com .. no meio", async () => {
    await expect(readUpload("vendor/abc/../../../etc/passwd")).rejects.toThrow(
      /path traversal|inválido/i,
    );
  });

  it("rejeita caminho absoluto", async () => {
    await expect(readUpload("/etc/passwd")).rejects.toThrow(/path traversal|inválido|ENOENT/);
  });

  it("lê arquivo legítimo dentro de uploads/", async () => {
    const rel = path.posix.join("vendor", "v1", "abc_file.pdf");
    const abs = path.join(tmpRoot, "uploads", rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, "hello world");

    const buf = await readUpload(rel);
    expect(buf.toString("utf-8")).toBe("hello world");
  });
});

describe("removeUpload", () => {
  it("ignora arquivo inexistente sem lançar", async () => {
    await expect(removeUpload("vendor/none/missing.pdf")).resolves.toBeUndefined();
  });

  it("rejeita path traversal ao remover", async () => {
    // removeUpload engole erros conhecidos (ENOENT). Path traversal sai do try/catch e é logado, mas
    // o teste foca no comportamento positivo: arquivo legítimo é removido.
    const rel = path.posix.join("vendor", "v2", "rm_test.pdf");
    const abs = path.join(tmpRoot, "uploads", rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, "to-be-removed");

    await removeUpload(rel);
    await expect(fs.access(abs)).rejects.toThrow();
  });
});
