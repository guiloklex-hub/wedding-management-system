import { generateSecret, generateURI, verifySync } from "otplib";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
  qrCodeSvg: string;
};

const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$/;

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5)
      .toString("hex")
      .slice(0, 10)
      .toUpperCase()
      .replace(/(.{5})/, "$1-")
      .slice(0, 11),
  );
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(
    codes.map((c) => bcrypt.hash(c.trim().toUpperCase(), BCRYPT_ROUNDS)),
  );
}

export async function createTotpSetup(label: string, issuer: string): Promise<TotpSetup> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer, label, secret });
  const qrCodeSvg = await QRCode.toString(otpauthUrl, {
    type: "svg",
    margin: 1,
    width: 220,
    color: { dark: "#fafafa", light: "#0a0a0a" },
  });
  return { secret, otpauthUrl, qrCodeSvg };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  const trimmed = token.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  try {
    const result = verifySync({ token: trimmed, secret });
    return !!result?.valid;
  } catch (err) {
    console.error("[totp] verify failed", err);
    return false;
  }
}

export async function checkBackupCode(
  code: string,
  storedJson: string | null,
): Promise<{ valid: boolean; remaining: string[] }> {
  const trimmed = code.trim().toUpperCase();
  if (!storedJson) return { valid: false, remaining: [] };
  let codes: string[];
  try {
    const parsed = JSON.parse(storedJson);
    if (!Array.isArray(parsed)) return { valid: false, remaining: [] };
    codes = parsed.filter((c): c is string => typeof c === "string");
  } catch {
    return { valid: false, remaining: [] };
  }

  for (let i = 0; i < codes.length; i++) {
    const stored = codes[i];
    let isMatch = false;
    if (BCRYPT_PREFIX.test(stored)) {
      try {
        isMatch = await bcrypt.compare(trimmed, stored);
      } catch {
        isMatch = false;
      }
    } else {
      isMatch = stored === trimmed;
    }
    if (isMatch) {
      const remaining = [...codes.slice(0, i), ...codes.slice(i + 1)];
      return { valid: true, remaining };
    }
  }
  return { valid: false, remaining: codes };
}
