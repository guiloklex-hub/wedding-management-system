import path from "node:path";
import { rm } from "node:fs/promises";
import { maybeSendDownAlert, sendRecoveredAlert } from "./whatsapp-alerts";

const AUTH_DIR = path.join(process.cwd(), ".whatsapp-auth");

const ALERT_AFTER_ATTEMPTS = 3;
const ALERT_COOLDOWN_MS = 30 * 60_000;
const WATCHDOG_INTERVAL_MS = 60_000;
const WATCHDOG_IDLE_THRESHOLD_MS = 90_000;

type State = "DISCONNECTED" | "CONNECTING" | "WAITING_QR" | "CONNECTED";

export type WhatsAppStatus = {
  state: State;
  qr: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  attempts: number;
  lastDisconnectAt: Date | null;
  lastConnectedAt: Date | null;
  needsManualAction: boolean;
  downAlertSentAt: Date | null;
};

type WaGlobals = {
  _waSock?: unknown;
  _waState?: WhatsAppStatus;
  _waStarting?: Promise<void> | null;
  _waWatchdog?: ReturnType<typeof setInterval> | null;
};
const g = globalThis as unknown as WaGlobals;

function getStateRef(): WhatsAppStatus {
  if (!g._waState) {
    g._waState = {
      state: "DISCONNECTED",
      qr: null,
      phoneNumber: null,
      lastError: null,
      attempts: 0,
      lastDisconnectAt: null,
      lastConnectedAt: null,
      needsManualAction: false,
      downAlertSentAt: null,
    };
  }
  return g._waState;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return { ...getStateRef() };
}

export function backoffDelay(attempts: number): number {
  if (attempts <= 0) return 3000;
  return Math.min(60_000, 3000 * 2 ** (attempts - 1));
}

function shouldSendDownAlert(ref: WhatsAppStatus): boolean {
  if (!ref.downAlertSentAt) return true;
  return Date.now() - ref.downAlertSentAt.getTime() > ALERT_COOLDOWN_MS;
}

async function importBaileys() {
  const mod = await import("@whiskeysockets/baileys");
  return mod;
}

async function startSocket(): Promise<void> {
  const ref = getStateRef();
  if (ref.state === "CONNECTED" || ref.state === "CONNECTING" || ref.state === "WAITING_QR") {
    return;
  }

  ref.state = "CONNECTING";
  ref.qr = null;
  ref.lastError = null;

  try {
    const baileys = await importBaileys();
    const { Browsers, DisconnectReason } = baileys;
    const loadAuthState = (
      baileys as {
        useMultiFileAuthState: (dir: string) => Promise<{
          state: unknown;
          saveCreds: () => Promise<void>;
        }>;
      }
    ).useMultiFileAuthState;
    const makeWASocket =
      (baileys as { default?: unknown }).default ??
      (baileys as { makeWASocket?: unknown }).makeWASocket;

    if (typeof makeWASocket !== "function") {
      throw new Error("Baileys: makeWASocket não pôde ser resolvido");
    }

    const { state, saveCreds } = await loadAuthState(AUTH_DIR);

    const sock = (makeWASocket as (opts: unknown) => unknown)({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Wedding Finance"),
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    g._waSock = sock;

    const evSock = sock as {
      ev: {
        on: (event: string, handler: (update: unknown) => void) => void;
      };
      user?: { id?: string };
      logout?: () => Promise<void>;
    };

    evSock.ev.on("creds.update", saveCreds as () => void);

    evSock.ev.on("connection.update", (update: unknown) => {
      const u = update as {
        qr?: string;
        connection?: "open" | "close" | "connecting";
        lastDisconnect?: {
          error?: { output?: { statusCode?: number }; message?: string };
        };
      };

      if (u.qr) {
        const wasConnectedBefore = ref.lastConnectedAt !== null;
        ref.state = "WAITING_QR";
        ref.qr = u.qr;
        if (wasConnectedBefore) {
          ref.needsManualAction = true;
          if (shouldSendDownAlert(ref)) {
            ref.downAlertSentAt = new Date();
            void maybeSendDownAlert({
              reason: "WAITING_QR_AGAIN",
              attempts: ref.attempts,
              lastError: ref.lastError,
            });
          }
        }
      }

      if (u.connection === "open") {
        const wasDown = ref.state !== "CONNECTED" && ref.downAlertSentAt !== null;
        const downtimeMs =
          wasDown && ref.lastDisconnectAt
            ? Date.now() - ref.lastDisconnectAt.getTime()
            : 0;
        ref.state = "CONNECTED";
        ref.qr = null;
        ref.lastError = null;
        ref.attempts = 0;
        ref.needsManualAction = false;
        ref.lastConnectedAt = new Date();
        const id = (sock as { user?: { id?: string } }).user?.id;
        ref.phoneNumber = id ? id.split(":")[0].split("@")[0] : null;
        if (wasDown) {
          ref.downAlertSentAt = null;
          const downtimeMinutes = Math.max(1, Math.round(downtimeMs / 60_000));
          void sendRecoveredAlert(downtimeMinutes);
        }
      }

      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const message = u.lastDisconnect?.error?.message;
        const loggedOut = code === DisconnectReason.loggedOut;
        ref.state = "DISCONNECTED";
        ref.qr = null;
        ref.phoneNumber = null;
        ref.lastDisconnectAt = new Date();
        ref.needsManualAction = loggedOut;
        if (message) ref.lastError = message;
        g._waSock = undefined;
        g._waStarting = null;

        if (loggedOut) {
          if (shouldSendDownAlert(ref)) {
            ref.downAlertSentAt = new Date();
            void maybeSendDownAlert({
              reason: "LOGGED_OUT",
              attempts: ref.attempts,
              lastError: ref.lastError,
            });
          }
          return;
        }

        ref.attempts += 1;
        if (ref.attempts >= ALERT_AFTER_ATTEMPTS && shouldSendDownAlert(ref)) {
          ref.downAlertSentAt = new Date();
          void maybeSendDownAlert({
            reason: "CONNECTION_LOST",
            attempts: ref.attempts,
            lastError: ref.lastError,
          });
        }

        const delayMs = backoffDelay(ref.attempts);
        setTimeout(() => {
          startSocket().catch(() => {});
        }, delayMs);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ref.state = "DISCONNECTED";
    ref.lastError = message;
    g._waSock = undefined;
    throw err;
  }
}

export async function ensureWhatsAppStarted(): Promise<void> {
  if (g._waStarting) return g._waStarting;
  const ref = getStateRef();
  if (ref.state === "CONNECTED") return;
  const p = startSocket().finally(() => {
    g._waStarting = null;
  });
  g._waStarting = p;
  return p;
}

export async function disconnectWhatsApp(): Promise<void> {
  const sock = g._waSock as
    | {
        logout?: () => Promise<void>;
        end?: (err?: Error) => void;
      }
    | undefined;

  try {
    await sock?.logout?.();
  } catch {}
  try {
    sock?.end?.(undefined);
  } catch {}

  g._waSock = undefined;
  g._waStarting = null;
  const ref = getStateRef();
  ref.state = "DISCONNECTED";
  ref.qr = null;
  ref.phoneNumber = null;
  ref.lastError = null;
  ref.attempts = 0;
  ref.lastDisconnectAt = null;
  ref.lastConnectedAt = null;
  ref.needsManualAction = false;
  ref.downAlertSentAt = null;

  try {
    await rm(AUTH_DIR, { recursive: true, force: true });
  } catch {}
}

export function startWatchdog(): void {
  if (g._waWatchdog) return;
  const timer = setInterval(() => {
    const ref = getStateRef();
    if (ref.state !== "DISCONNECTED") return;
    if (ref.needsManualAction) return;
    if (g._waStarting) return;
    const idleMs = ref.lastDisconnectAt
      ? Date.now() - ref.lastDisconnectAt.getTime()
      : Number.POSITIVE_INFINITY;
    if (idleMs > WATCHDOG_IDLE_THRESHOLD_MS) {
      ensureWhatsAppStarted().catch((err) => {
        console.error("[whatsapp] watchdog falhou ao reiniciar:", err);
      });
    }
  }, WATCHDOG_INTERVAL_MS);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
  g._waWatchdog = timer;
}

export function stopWatchdog(): void {
  if (g._waWatchdog) {
    clearInterval(g._waWatchdog);
    g._waWatchdog = null;
  }
}

function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!/^\+\d{10,15}$/.test(trimmed)) return null;
  return trimmed.slice(1);
}

export function isValidPhone(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  return /^\+\d{10,15}$/.test(phone.trim());
}

export type SendWaResult =
  | { ok: true }
  | { ok: false; error: string };

async function waitForConnected(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = getStateRef().state as State;
    if (state === "CONNECTED") return true;
    if (state === "DISCONNECTED") return false;
    await new Promise((r) => setTimeout(r, 200));
  }
  return (getStateRef().state as State) === "CONNECTED";
}

export async function sendWhatsApp(
  phone: string,
  text: string,
): Promise<SendWaResult> {
  const number = normalizePhone(phone);
  if (!number) return { ok: false, error: "Telefone inválido (use formato +5511999999999)" };

  const ref = getStateRef();
  if (ref.state !== "CONNECTED") {
    try {
      await ensureWhatsAppStarted();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Falha ao iniciar WhatsApp: ${message}` };
    }
    const ready = await waitForConnected(15_000);
    if (!ready) {
      return {
        ok: false,
        error:
          ref.state === "WAITING_QR"
            ? "WhatsApp aguardando leitura do QR Code"
            : "WhatsApp não conectado",
      };
    }
  }

  const sock = g._waSock as
    | {
        sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
      }
    | undefined;

  if (!sock) return { ok: false, error: "Socket WhatsApp não disponível" };

  try {
    const jid = `${number}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function getQrDataUrl(): Promise<string | null> {
  const ref = getStateRef();
  if (!ref.qr) return null;
  const qrcode = await import("qrcode");
  return qrcode.toDataURL(ref.qr, { margin: 1, width: 256 });
}
