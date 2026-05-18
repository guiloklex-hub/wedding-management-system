import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
  parseAcceptLanguage,
} from "./config";

const NAMESPACES = [
  "common",
  "auth",
  "dashboard",
  "actions",
  "notifications",
  "help",
  "changelog",
  "rsvp",
] as const;

type Namespace = (typeof NAMESPACES)[number];

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = (await import(`../messages/${locale}/${ns}.json`)) as {
        default: Record<string, unknown>;
      };
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Namespace, Record<string, unknown>>;
}

async function resolveLocaleFromRequest(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionLocale = (session?.user as { locale?: unknown } | undefined)?.locale;
    if (isLocale(sessionLocale)) return sessionLocale;
  } catch {
    // Auth.js indisponível (build estático/edge) — segue para próximos fallbacks.
  }

  const headerStore = await headers();
  const accept = headerStore.get("accept-language");
  const parsed = parseAcceptLanguage(accept);
  if (parsed) return parsed;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocaleFromRequest();
  const messages = await loadMessages(locale);
  return {
    locale,
    messages,
    timeZone: locale === "pt-BR" ? "America/Sao_Paulo" : "UTC",
  };
});
