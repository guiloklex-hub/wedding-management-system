import { describe, it, expect } from "vitest";
import {
  detectMagic,
  assertMagicMatchesMime,
  assertAllowedForKind,
  assertSizeForKind,
  maxBytesForKind,
  FileValidationError,
} from "./file-validation";

function pdfBuffer(content = ""): Buffer {
  return Buffer.concat([Buffer.from("%PDF-1.4\n", "ascii"), Buffer.from(content, "ascii")]);
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function jpegBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
}

function webpBuffer(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(8, 4);
  buf.write("WEBP", 8, "ascii");
  return buf;
}

function heicBuffer(brand = "heic"): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(16, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write(brand, 8, "ascii");
  return buf;
}

describe("detectMagic", () => {
  it("identifica PDF pelo header %PDF-", () => {
    expect(detectMagic(pdfBuffer())).toBe("pdf");
  });

  it("identifica PNG pelos 8 bytes de assinatura", () => {
    expect(detectMagic(pngBuffer())).toBe("png");
  });

  it("identifica JPEG por FF D8 FF", () => {
    expect(detectMagic(jpegBuffer())).toBe("jpeg");
  });

  it("identifica WEBP exigindo RIFF + WEBP", () => {
    expect(detectMagic(webpBuffer())).toBe("webp");
  });

  it("não confunde WAV (RIFF sem WEBP) com WEBP", () => {
    const buf = Buffer.alloc(16);
    buf.write("RIFF", 0, "ascii");
    buf.write("WAVE", 8, "ascii");
    expect(detectMagic(buf)).toBe("unknown");
  });

  it("identifica HEIC com brand heic no box ftyp", () => {
    expect(detectMagic(heicBuffer("heic"))).toBe("heic");
  });

  it("aceita brand mif1 como HEIC", () => {
    expect(detectMagic(heicBuffer("mif1"))).toBe("heic");
  });

  it("retorna unknown para buffer aleatório", () => {
    expect(detectMagic(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).toBe("unknown");
  });

  it("retorna unknown para buffer vazio", () => {
    expect(detectMagic(Buffer.alloc(0))).toBe("unknown");
  });
});

describe("assertMagicMatchesMime", () => {
  it("aceita PDF + application/pdf", () => {
    expect(() => assertMagicMatchesMime("pdf", "application/pdf")).not.toThrow();
  });

  it("rejeita PDF declarado como image/png (spoof)", () => {
    expect(() => assertMagicMatchesMime("pdf", "image/png")).toThrow(FileValidationError);
  });

  it("rejeita unknown sempre", () => {
    expect(() => assertMagicMatchesMime("unknown", "application/pdf")).toThrow(
      FileValidationError,
    );
  });

  it("aceita JPEG variante image/jpg", () => {
    expect(() => assertMagicMatchesMime("jpeg", "image/jpg")).not.toThrow();
  });
});

describe("assertAllowedForKind", () => {
  it("CONTRACT só aceita application/pdf", () => {
    expect(() => assertAllowedForKind("CONTRACT", "application/pdf")).not.toThrow();
    expect(() => assertAllowedForKind("CONTRACT", "image/png")).toThrow(FileValidationError);
  });

  it("PHOTO aceita imagens, rejeita PDF", () => {
    expect(() => assertAllowedForKind("PHOTO", "image/jpeg")).not.toThrow();
    expect(() => assertAllowedForKind("PHOTO", "application/pdf")).toThrow(FileValidationError);
  });

  it("rejeita kind desconhecido", () => {
    expect(() => assertAllowedForKind("UNKNOWN_KIND", "application/pdf")).toThrow(
      FileValidationError,
    );
  });
});

describe("assertSizeForKind", () => {
  it("permite tamanho dentro do limite", () => {
    expect(() => assertSizeForKind("CONTRACT", 1024)).not.toThrow();
  });

  it("rejeita acima do limite do CONTRACT (8MB)", () => {
    expect(() => assertSizeForKind("CONTRACT", 9 * 1024 * 1024)).toThrow(FileValidationError);
  });

  it("usa limite default para kind desconhecido", () => {
    expect(maxBytesForKind("XXX_UNKNOWN")).toBe(10 * 1024 * 1024);
  });
});
