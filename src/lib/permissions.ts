export const ROLES = ["ADMIN", "GROOM", "BRIDE", "PLANNER", "FAMILY", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  GROOM: "Noivo",
  BRIDE: "Noiva",
  PLANNER: "Planejador(a)",
  FAMILY: "Família",
  VIEWER: "Leitura",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: "Acesso total, gerencia usuários e segurança.",
  GROOM: "Noivo — edita tudo e gerencia equipe.",
  BRIDE: "Noiva — edita tudo e gerencia equipe.",
  PLANNER: "Planejador(a) — edita conteúdo do casamento.",
  FAMILY: "Família — somente leitura com acesso a detalhes.",
  VIEWER: "Visualiza informações básicas.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function canManageUsers(role?: string | null): boolean {
  return role === "ADMIN" || role === "GROOM" || role === "BRIDE";
}

export function canEdit(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE", "PLANNER"].includes(role ?? "");
}

export function canViewSensitiveFinance(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE"].includes(role ?? "");
}

const CONTRACT_KINDS = new Set(["CONTRACT", "INVOICE", "RECEIPT"]);
const PLANNER_KINDS = new Set([
  "CONTRACT",
  "INVOICE",
  "RECEIPT",
  "PROPOSAL",
  "ID_DOC",
  "PHOTO",
  "OTHER",
]);
const FAMILY_KINDS = new Set(["PROPOSAL", "PHOTO", "OTHER"]);

export function canUploadContract(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE", "PLANNER"].includes(role ?? "");
}

export function canViewContract(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE", "PLANNER"].includes(role ?? "");
}

export function canManageContract(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE"].includes(role ?? "");
}

export function canSignContract(role?: string | null): boolean {
  return ["ADMIN", "GROOM", "BRIDE"].includes(role ?? "");
}

export function canViewAttachmentKind(role: string | null | undefined, kind: string): boolean {
  const safeRole = role ?? "";
  if (!isRole(safeRole) && safeRole !== "ADMIN") return false;
  if (CONTRACT_KINDS.has(kind)) return canViewContract(safeRole);
  if (["ADMIN", "GROOM", "BRIDE", "PLANNER"].includes(safeRole)) return PLANNER_KINDS.has(kind) || kind === "OTHER";
  if (safeRole === "FAMILY") return FAMILY_KINDS.has(kind);
  return false;
}

export function canUploadAttachmentKind(role: string | null | undefined, kind: string): boolean {
  if (CONTRACT_KINDS.has(kind)) return canUploadContract(role);
  return canEdit(role);
}
