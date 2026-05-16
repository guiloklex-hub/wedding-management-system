/**
 * Pix BR Code (EMV) generator — static QR with key, name, city and optional amount.
 *
 * Format spec: BACEN "Manual do BR Code", EMVCo TLV with CRC16-CCITT (poly 0x1021, init 0xFFFF).
 * Each field is `IDLEN<value>` where ID and LEN are 2 ASCII digits.
 */

export type PixInput = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
};

const PIX_GUI = "br.gov.bcb.pix";

function tlv(id: string, value: string): string {
  if (id.length !== 2) throw new Error("BR Code: ID must be 2 chars");
  const len = value.length.toString().padStart(2, "0");
  if (len.length !== 2) throw new Error("BR Code: value too long for TLV");
  return `${id}${len}${value}`;
}

function sanitizeAscii(input: string, max: number): string {
  // Normalize to NFKD then strip combining marks (best effort to ASCII)
  const folded = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return folded.slice(0, max);
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("BR Code: invalid amount");
  }
  // 2 decimals, dot separator, no thousand grouping, max 13 chars
  return amount.toFixed(2);
}

function sanitizeTxid(txid: string | undefined): string {
  if (!txid) return "***";
  const cleaned = txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return cleaned.length > 0 ? cleaned : "***";
}

function crc16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ polynomial) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Generate the BR Code (Pix copia-e-cola) string.
 * The returned string can be encoded directly into a QR Code.
 */
export function generateBrCode(input: PixInput): string {
  const key = input.key.trim();
  if (!key) throw new Error("BR Code: pix key is required");
  if (key.length > 77) throw new Error("BR Code: pix key too long");

  const name = sanitizeAscii(input.merchantName, 25);
  const city = sanitizeAscii(input.merchantCity, 15);
  if (!name) throw new Error("BR Code: merchant name is required");
  if (!city) throw new Error("BR Code: merchant city is required");

  const merchantAccount = tlv("00", PIX_GUI) + tlv("01", key);

  const additional = tlv("05", sanitizeTxid(input.txid));

  const parts: string[] = [];
  parts.push(tlv("00", "01")); // Payload format indicator
  parts.push(tlv("01", "11")); // Static QR (one-time use disabled)
  parts.push(tlv("26", merchantAccount));
  parts.push(tlv("52", "0000")); // MCC
  parts.push(tlv("53", "986")); // Currency: BRL
  if (typeof input.amount === "number" && input.amount > 0) {
    parts.push(tlv("54", formatAmount(input.amount)));
  }
  parts.push(tlv("58", "BR")); // Country
  parts.push(tlv("59", name));
  parts.push(tlv("60", city));
  parts.push(tlv("62", additional));

  const partial = parts.join("") + "6304";
  const checksum = crc16(partial);
  return partial + checksum;
}

/**
 * Hint of valid pix key types for UI.
 */
export const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];
