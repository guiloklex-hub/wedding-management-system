import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type { Locale } from "./src/i18n/config";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
    delete: () => undefined,
  })),
}));

vi.mock("next-intl/server", async () => {
  const { DEFAULT_LOCALE } = await import("./src/i18n/config");

  const cache = new Map<Locale, Record<string, unknown>>();

  async function loadLocale(locale: Locale): Promise<Record<string, unknown>> {
    if (cache.has(locale)) return cache.get(locale)!;
    const namespaces = [
      "common",
      "auth",
      "dashboard",
      "actions",
      "notifications",
      "help",
      "changelog",
      "rsvp",
    ];
    const obj: Record<string, unknown> = {};
    for (const ns of namespaces) {
      const m = (await import(`./src/messages/${locale}/${ns}.json`)) as {
        default: Record<string, unknown>;
      };
      obj[ns] = m.default;
    }
    cache.set(locale, obj);
    return obj;
  }

  function resolveValue(messages: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, messages);
  }

  function findPluralBlock(template: string, start: number): { var: string; body: string; end: number } | null {
    const head = template.slice(start);
    const headMatch = head.match(/^\{(\w+),\s*plural,/);
    if (!headMatch) return null;
    const varName = headMatch[1];
    let i = start + headMatch[0].length;
    let depth = 1;
    const bodyStart = i;
    while (i < template.length && depth > 0) {
      const ch = template[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return { var: varName, body: template.slice(bodyStart, i), end: i + 1 };
        }
      }
      i += 1;
    }
    return null;
  }

  function parsePluralCases(body: string): Record<string, string> {
    const cases: Record<string, string> = {};
    let i = 0;
    while (i < body.length) {
      while (i < body.length && /\s/.test(body[i])) i += 1;
      if (i >= body.length) break;
      const keyMatch = body.slice(i).match(/^(=\d+|zero|one|two|few|many|other)\s*\{/);
      if (!keyMatch) break;
      const key = keyMatch[1];
      i += keyMatch[0].length;
      const valStart = i;
      let depth = 1;
      while (i < body.length && depth > 0) {
        if (body[i] === "{") depth += 1;
        else if (body[i] === "}") depth -= 1;
        if (depth > 0) i += 1;
      }
      cases[key] = body.slice(valStart, i);
      i += 1;
    }
    return cases;
  }

  function interpolate(template: string, values?: Record<string, unknown>): string {
    if (!values) return template;
    let result = "";
    let i = 0;
    while (i < template.length) {
      const block = findPluralBlock(template, i);
      if (block) {
        const v = values[block.var];
        if (typeof v === "number") {
          const cases = parsePluralCases(block.body);
          const exact = cases[`=${v}`];
          const branch =
            exact !== undefined
              ? exact
              : v === 1
                ? cases.one ?? cases.other ?? ""
                : cases.other ?? "";
          result += branch.replace(/#/g, String(v));
        }
        i = block.end;
        continue;
      }
      const simple = template.slice(i).match(/^\{(\w+)\}/);
      if (simple) {
        const v = values[simple[1]];
        result += v === undefined || v === null ? "" : String(v);
        i += simple[0].length;
        continue;
      }
      result += template[i];
      i += 1;
    }
    return result;
  }

  async function buildTranslator(opts: { locale: Locale; namespace?: string }) {
    const messages = await loadLocale(opts.locale);
    const baseValue = opts.namespace
      ? (resolveValue(messages, opts.namespace) as Record<string, unknown>)
      : (messages as Record<string, unknown>);

    const t: ((key: string, values?: Record<string, unknown>) => string) & {
      raw: (key: string) => unknown;
      markup: (key: string, values?: Record<string, unknown>) => string;
    } = Object.assign(
      (key: string, values?: Record<string, unknown>) => {
        const v = resolveValue(baseValue, key);
        if (typeof v === "string") return interpolate(v, values);
        return key;
      },
      {
        raw: (key: string) => resolveValue(baseValue, key),
        markup: (key: string, values?: Record<string, unknown>) => {
          const v = resolveValue(baseValue, key);
          if (typeof v !== "string") return key;
          let html = v;
          if (values) {
            for (const [k, val] of Object.entries(values)) {
              if (typeof val === "function") {
                html = html.replace(
                  new RegExp(`<${k}>([^<]*)</${k}>`, "g"),
                  (_, inner) => (val as (c: string) => string)(inner),
                );
              }
            }
          }
          return interpolate(html, values);
        },
      },
    );
    return t;
  }

  return {
    async getTranslations(arg?: string | { locale?: string; namespace?: string }) {
      if (typeof arg === "string") {
        return buildTranslator({ locale: DEFAULT_LOCALE as Locale, namespace: arg });
      }
      const locale = ((arg?.locale as Locale | undefined) ?? DEFAULT_LOCALE) as Locale;
      return buildTranslator({ locale, namespace: arg?.namespace });
    },
    async getLocale() {
      return DEFAULT_LOCALE;
    },
    async getMessages(opts?: { locale?: string }) {
      const locale = ((opts?.locale as Locale | undefined) ?? DEFAULT_LOCALE) as Locale;
      return loadLocale(locale);
    },
  };
});

vi.mock("@/lib/finance-access", () => ({
  requireFinanceAccess: vi.fn().mockResolvedValue({
    user: { id: "test-user", role: "ADMIN" },
  }),
  hasFinanceAccess: vi.fn().mockResolvedValue(true),
  denyIfNoFinance: vi.fn().mockResolvedValue(null),
  denyIfNoEdit: vi.fn().mockResolvedValue(null),
  denyIfNoManage: vi.fn().mockResolvedValue(null),
}));

afterEach(async () => {
  cleanup();
  const { prisma } = await import("@/lib/prisma");
  mockReset(prisma);
  vi.clearAllMocks();
});

export {};
