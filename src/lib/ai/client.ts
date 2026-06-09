import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getAiConfig } from "./config";

// Singleton em globalThis (mesmo padrão de notifications/email.ts). Recriado se a
// chave mudar em runtime. `null` quando a IA está desligada.

type AiGlobals = {
  _aiClient?: GoogleGenAI;
  _aiClientKey?: string;
};
const g = globalThis as unknown as AiGlobals;

export function getAiClient(): GoogleGenAI | null {
  const cfg = getAiConfig();
  if (!cfg) return null;
  if (g._aiClient && g._aiClientKey === cfg.apiKey) return g._aiClient;
  g._aiClient = new GoogleGenAI({ apiKey: cfg.apiKey });
  g._aiClientKey = cfg.apiKey;
  return g._aiClient;
}
