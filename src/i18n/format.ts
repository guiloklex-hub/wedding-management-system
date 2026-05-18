import { DEFAULT_LOCALE, type Locale, coerceLocale } from "./config";

const TIMEZONE_BY_LOCALE: Record<Locale, string> = {
  "pt-BR": "America/Sao_Paulo",
  en: "UTC",
  es: "UTC",
};

function resolveTimeZone(locale: Locale, override?: string): string {
  return override ?? TIMEZONE_BY_LOCALE[locale] ?? "UTC";
}

export function formatCurrency(
  value: number,
  currency: string = "BRL",
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(coerceLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(
  value: number,
  currency: string = "BRL",
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat(coerceLocale(locale), {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatCurrency(value, currency, locale);
}

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  timeZone?: string;
}

export function formatDate(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE,
  options?: FormatDateOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const timeZone = resolveTimeZone(locale, options?.timeZone);
  return new Intl.DateTimeFormat(coerceLocale(locale), {
    timeZone,
    ...(options ?? {}),
  }).format(d);
}

export function formatDateTime(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE,
  options?: FormatDateOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const timeZone = resolveTimeZone(locale, options?.timeZone);
  return new Intl.DateTimeFormat(coerceLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
    ...(options ?? {}),
  }).format(d);
}

export function toIsoDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}
