import { detectMagic, assertMagicMatchesMime } from "@/lib/file-validation";

export const ART_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
export const ART_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Valida a arte enviada pelos módulos de comunicação (tamanho, MIME e assinatura
 * real do arquivo). Devolve a chave de erro de i18n ou `null`; lança
 * `FileValidationError` quando os bytes não batem com o MIME declarado.
 */
export async function validateArtFile(file: File): Promise<"fileTooLarge" | "fileTypeInvalid" | null> {
  if (file.size > ART_MAX_BYTES) return "fileTooLarge";
  if (!ART_MIME.has(file.type)) return "fileTypeInvalid";
  const bytes = Buffer.from(await file.arrayBuffer());
  assertMagicMatchesMime(detectMagic(bytes), file.type);
  return null;
}
