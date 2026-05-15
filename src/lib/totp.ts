import { generateSecret, generateURI, verifySync } from "otplib";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
  qrCodeSvg: string;
};

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

export function checkBackupCode(code: string, storedJson: string | null): { valid: boolean; remaining: string[] } {
  const trimmed = code.trim().toUpperCase();
  if (!storedJson) return { valid: false, remaining: [] };
  let codes: string[] = [];
  try {
    codes = JSON.parse(storedJson) as string[];
  } catch {
    return { valid: false, remaining: [] };
  }
  const idx = codes.indexOf(trimmed);
  if (idx === -1) return { valid: false, remaining: codes };
  const next = [...codes.slice(0, idx), ...codes.slice(idx + 1)];
  return { valid: true, remaining: next };
}
