import "server-only";
import { getEventConfig } from "@/lib/event-config";
import { isAiEnabled } from "./config";

// Gate efetivo da IA, combinando os dois níveis de opt-in:
//   1. master switch por env (GEMINI_API_KEY) — isAiEnabled()
//   2. toggle por casal (EventSettings.aiEnabled)
// Use em Server Components (passe o boolean resolvido como prop ao client) e em
// Server Actions, antes de oferecer qualquer ação de IA.
export async function aiFeatureEnabled(): Promise<boolean> {
  if (!isAiEnabled()) return false;
  const cfg = await getEventConfig();
  return cfg.aiEnabled;
}
