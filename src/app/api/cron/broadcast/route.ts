import { NextResponse } from "next/server";
import { timingSafeEquals } from "@/lib/timing-safe";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { loadSaveTheDateContext } from "@/lib/notifications/save-the-date";
import { processOne, type ProcessOutcome } from "@/lib/notifications/broadcast-worker";

export const dynamic = "force-dynamic";

const BATCH_MAX = 10;
const STEP_DELAY_MS = Math.max(1000, Number(process.env.BROADCAST_INTERVAL_MS ?? 4000));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Backstop do worker em processo: drena um lote pequeno de destinatários
 * pendentes com throttle. Útil quando o servidor reinicia sem UI aberta.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`cron-broadcast:${ip}`, 5, 60_000).ok) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET não configurado" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!timingSafeEquals(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const loaded = await loadSaveTheDateContext();
  const ctx = loaded.ok ? loaded.ctx : undefined;

  const summary: Record<ProcessOutcome, number> = {
    SENT: 0,
    FAILED: 0,
    SKIPPED: 0,
    IDLE: 0,
  };

  for (let i = 0; i < BATCH_MAX; i++) {
    const outcome = await processOne(ctx);
    summary[outcome] += 1;
    if (outcome === "IDLE") break;
    if (i < BATCH_MAX - 1) await sleep(STEP_DELAY_MS);
  }

  return NextResponse.json({
    sent: summary.SENT,
    failed: summary.FAILED,
    skipped: summary.SKIPPED,
    drained: summary.IDLE > 0,
  });
}
