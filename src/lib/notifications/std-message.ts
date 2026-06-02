/**
 * Helpers puros (sem I/O) para a mensagem do Save the Date — compartilhados pelo
 * template (servidor) e pelo preview (client), para não divergirem.
 */

export type BaseTags = {
  nomes: string;
  convidados: string;
  data: string;
  local: string;
};

const BASE_KEYS = new Set(["nomes", "convidados", "data", "local"]);

/**
 * Substitui apenas as variáveis básicas ({nomes}, {convidados}, {data}, {local}).
 * Mantém {site} e {site-presentes} intactas para tratamento por canal.
 * Aceita hífen no nome da variável (ex.: {site-presentes}).
 */
export function interpolateBaseTags(template: string, tags: BaseTags): string {
  return template.replace(/\{([\w-]+)\}/g, (match, key: string) =>
    BASE_KEYS.has(key) ? tags[key as keyof BaseTags] : match,
  );
}

export type SiteTagResult = {
  text: string;
  usedSite: boolean;
  usedRegistry: boolean;
};

/**
 * Substitui {site} e {site-presentes} pelos respectivos URLs e informa se cada
 * uma foi usada (para o chamador decidir se ainda anexa a linha no fim).
 * {site-presentes} é tratada antes de {site} para evitar colisão de prefixo.
 */
export function applySiteTags(
  text: string,
  links: { siteUrl: string | null; registryUrl: string | null },
): SiteTagResult {
  let usedSite = false;
  let usedRegistry = false;

  let out = text.replace(/\{site-presentes\}/g, () => {
    usedRegistry = true;
    return links.registryUrl ?? "";
  });
  out = out.replace(/\{site\}/g, () => {
    usedSite = true;
    return links.siteUrl ?? "";
  });

  return { text: out, usedSite, usedRegistry };
}

/**
 * Normaliza um telefone para E.164, **sem** alterar números que já trazem código
 * de país (qualquer coisa começando com "+", ex.: +1, +34, +351).
 * Só completa "+55" quando o número está sem DDI e tem cara de brasileiro.
 * Retorna o valor original quando não há regra segura.
 */
export function normalizeMsisdn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return raw;

  // Já tem DDI explícito — preserva o código (apenas remove formatação).
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D+/g, "");
  }

  const digits = trimmed.replace(/\D+/g, "");
  // Já vem com 55 + DDD + número (12 ou 13 dígitos).
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return "+" + digits;
  }
  // DDD + número, sem DDI (10 ou 11 dígitos) → assume Brasil.
  if (digits.length === 10 || digits.length === 11) {
    return "+55" + digits;
  }
  // Não dá para inferir com segurança — devolve como veio.
  return raw;
}
