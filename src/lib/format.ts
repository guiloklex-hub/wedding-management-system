import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import {
  formatCompactCurrency as formatCompactCurrencyImpl,
  formatCurrency as formatCurrencyImpl,
  formatDate as formatDateImpl,
  formatDateTime as formatDateTimeImpl,
  toIsoDate as toIsoDateImpl,
} from "@/i18n/format";

export type { Locale };

export function formatCurrency(
  value: number,
  currency: string = "BRL",
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatCurrencyImpl(value, currency, locale);
}

export function formatCompactCurrency(
  value: number,
  currency: string = "BRL",
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatCompactCurrencyImpl(value, currency, locale);
}

export function formatDate(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDateImpl(date, locale, options);
}

export function formatDateTime(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDateTimeImpl(date, locale, options);
}

export function formatDateBR(date: Date | string): string {
  return formatDateImpl(date, "pt-BR", { timeZone: "UTC" });
}

export function formatDateTimeBR(date: Date | string): string {
  return formatDateTimeImpl(date, "pt-BR");
}

export function toIsoDate(date: Date | null): string {
  return toIsoDateImpl(date);
}
