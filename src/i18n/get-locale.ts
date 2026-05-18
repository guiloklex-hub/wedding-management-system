import "server-only";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
  parseAcceptLanguage,
} from "./config";

export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionLocale = (session?.user as { locale?: unknown } | undefined)?.locale;
    if (isLocale(sessionLocale)) return sessionLocale;
  } catch {
    // ignora
  }

  const headerStore = await headers();
  const accept = headerStore.get("accept-language");
  return parseAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}
