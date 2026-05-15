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
