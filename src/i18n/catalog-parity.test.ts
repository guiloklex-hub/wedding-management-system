import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { LOCALES, DEFAULT_LOCALE } from "./config";

const root = path.join(process.cwd(), "src/messages");

function leaves(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? leaves(v as Record<string, unknown>, key) : [key];
  });
}

function load(locale: string, file: string): string[] {
  return leaves(JSON.parse(readFileSync(path.join(root, locale, file), "utf8"))).sort();
}

describe("catálogos i18n", () => {
  const files = readdirSync(path.join(root, DEFAULT_LOCALE)).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    it(`${file} tem as mesmas chaves em todos os idiomas`, () => {
      const base = load(DEFAULT_LOCALE, file);
      for (const locale of LOCALES) {
        expect(load(locale, file), `${locale}/${file}`).toEqual(base);
      }
    });
  }
});
