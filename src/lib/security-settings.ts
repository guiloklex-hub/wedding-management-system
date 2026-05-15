import { prisma } from "@/lib/prisma";
import { ROLES, type Role, isRole } from "@/lib/permissions";

export type SecuritySettings = {
  require2FARoles: Role[];
  passwordMinLength: number;
};

const DEFAULT: SecuritySettings = {
  require2FARoles: [],
  passwordMinLength: 8,
};

function parseRoles(raw: string | null | undefined): Role[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRole);
  } catch {
    return [];
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const row = await prisma.securitySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  const require2FARoles = parseRoles(row.require2FARoles);
  return {
    require2FARoles: require2FARoles.length > 0 ? require2FARoles : DEFAULT.require2FARoles,
    passwordMinLength: row.passwordMinLength ?? DEFAULT.passwordMinLength,
  };
}

export async function setSecuritySettings(input: Partial<SecuritySettings>): Promise<SecuritySettings> {
  const data: { require2FARoles?: string; passwordMinLength?: number } = {};
  if (input.require2FARoles) {
    const filtered = input.require2FARoles.filter(isRole);
    data.require2FARoles = JSON.stringify(filtered);
  }
  if (typeof input.passwordMinLength === "number") {
    data.passwordMinLength = Math.max(6, Math.min(64, Math.floor(input.passwordMinLength)));
  }
  await prisma.securitySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return getSecuritySettings();
}

export function role2FARequired(role: string | undefined | null, settings: SecuritySettings): boolean {
  if (!role) return false;
  return settings.require2FARoles.includes(role as Role);
}

export { ROLES };
