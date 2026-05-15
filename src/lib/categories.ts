export type CategoryKey =
  | "VENUE"
  | "BUFFET"
  | "DECOR"
  | "PHOTO_VIDEO"
  | "MUSIC_DJ"
  | "DRESS"
  | "SUIT"
  | "BEAUTY"
  | "RINGS"
  | "INVITES"
  | "FAVORS"
  | "CAKE_SWEETS"
  | "BARTENDER"
  | "TRANSPORT"
  | "CEREMONY"
  | "CELEBRANT"
  | "PLANNER"
  | "HOTEL"
  | "HONEYMOON"
  | "STATIONERY"
  | "GIFTS"
  | "INSURANCE"
  | "OTHER";

export type CategoryDef = {
  key: CategoryKey;
  label: string;
  icon: string;
  color: string;
  description: string;
};

export const CATEGORIES: readonly CategoryDef[] = [
  { key: "VENUE", label: "Local / Espaço", icon: "Building2", color: "#a78bfa", description: "Locação do espaço da cerimônia e/ou recepção" },
  { key: "BUFFET", label: "Buffet / Comida", icon: "UtensilsCrossed", color: "#fb923c", description: "Comida, bebida não-alcoólica, garçom" },
  { key: "BARTENDER", label: "Bar / Drinks", icon: "Wine", color: "#f43f5e", description: "Bartender, drinks especiais, cerveja, vinho" },
  { key: "DECOR", label: "Decoração / Flores", icon: "Flower2", color: "#ec4899", description: "Floricultura, arranjos, ambientação" },
  { key: "PHOTO_VIDEO", label: "Foto e Vídeo", icon: "Camera", color: "#0ea5e9", description: "Fotógrafo, videomaker, álbum" },
  { key: "MUSIC_DJ", label: "Música / DJ", icon: "Music", color: "#8b5cf6", description: "DJ, banda, cerimonial musical" },
  { key: "DRESS", label: "Vestido / Noiva", icon: "Sparkles", color: "#f472b6", description: "Vestido, ateliê, ajustes, sapatos" },
  { key: "SUIT", label: "Traje do Noivo", icon: "Shirt", color: "#64748b", description: "Terno, alfaiataria, sapatos" },
  { key: "BEAUTY", label: "Beleza", icon: "Heart", color: "#fb7185", description: "Cabelo, maquiagem, esmaltação, day spa" },
  { key: "RINGS", label: "Alianças", icon: "CircleDot", color: "#facc15", description: "Alianças de noivado e casamento" },
  { key: "INVITES", label: "Convites / Papelaria", icon: "MailOpen", color: "#22c55e", description: "Convites físicos e digitais, save-the-date" },
  { key: "STATIONERY", label: "Identidade Visual", icon: "Palette", color: "#10b981", description: "Branding do casamento, menus, placas" },
  { key: "FAVORS", label: "Lembrancinhas", icon: "Gift", color: "#06b6d4", description: "Lembranças para convidados" },
  { key: "CAKE_SWEETS", label: "Bolo e Doces", icon: "Cake", color: "#e879f9", description: "Bolo, mesa de doces, churros, donut wall" },
  { key: "TRANSPORT", label: "Transporte", icon: "Car", color: "#84cc16", description: "Carro dos noivos, van para convidados" },
  { key: "CEREMONY", label: "Cerimônia", icon: "BookHeart", color: "#f59e0b", description: "Cartório, igreja, taxas, documentação" },
  { key: "CELEBRANT", label: "Celebrante / Cerimonialista", icon: "UserCheck", color: "#3b82f6", description: "Celebrante, mestre de cerimônia, assessoria" },
  { key: "PLANNER", label: "Assessoria / Wedding Planner", icon: "ClipboardCheck", color: "#14b8a6", description: "Planejamento, coordenação, dia do evento" },
  { key: "HOTEL", label: "Hospedagem", icon: "BedDouble", color: "#6366f1", description: "Hotel da noiva, hospedagem padrinhos" },
  { key: "HONEYMOON", label: "Lua de Mel", icon: "Plane", color: "#0891b2", description: "Viagem, hospedagem, passeios" },
  { key: "GIFTS", label: "Presentes / Padrinhos", icon: "PackageOpen", color: "#d946ef", description: "Mimos para padrinhos, pais, fornecedores" },
  { key: "INSURANCE", label: "Seguro / Caução", icon: "ShieldCheck", color: "#475569", description: "Seguro de evento, caução do espaço" },
  { key: "OTHER", label: "Outros", icon: "MoreHorizontal", color: "#71717a", description: "Despesas avulsas" },
] as const;

export const CATEGORY_MAP = new Map<CategoryKey, CategoryDef>(
  CATEGORIES.map((c) => [c.key, c]),
);

export function getCategory(key: string | null | undefined): CategoryDef | null {
  if (!key) return null;
  return CATEGORY_MAP.get(key as CategoryKey) ?? null;
}

export function resolveCategoryLabel(key: string | null | undefined, fallback: string): string {
  const def = getCategory(key);
  return def ? def.label : fallback;
}

export function resolveCategoryColor(key: string | null | undefined): string {
  const def = getCategory(key);
  return def ? def.color : "#71717a";
}
