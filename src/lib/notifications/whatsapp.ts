import path from "node:path";
import { rm } from "node:fs/promises";

const AUTH_DIR = path.join(process.cwd(), ".whatsapp-auth");

type State = "DISCONNECTED" | "CONNECTING" | "WAITING_QR" | "CONNECTED";

type WhatsAppStatus = {
  state: State;
  qr: string | null;
  phoneNumber: string | null;
  lastError: string | null;
};

type WaGlobals = {
  _waSock?: unknown;
  _waState?: WhatsAppStatus;
  _waStarting?: Promise<void> | null;
};
const g = globalThis as unknown as WaGlobals;

function getStateRef(): WhatsAppStatus {
  if (!g._waState) {
    g._waState = {
      state: "DISCONNECTED",
      qr: null,
      phoneNumber: null,
      lastError: null,
    };
  }
  return g._waState;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return { ...getStateRef() };
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
        lastDisconnect?: { error?: { output?: { statusCode?: number } } };
      };

      if (u.qr) {
        ref.state = "WAITING_QR";
        ref.qr = u.qr;
      }

      if (u.connection === "open") {
        ref.state = "CONNECTED";
        ref.qr = null;
        ref.lastError = null;
        const id = (sock as { user?: { id?: string } }).user?.id;
        ref.phoneNumber = id ? id.split(":")[0].split("@")[0] : null;
      }

      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        ref.state = "DISCONNECTED";
        ref.qr = null;
        ref.phoneNumber = null;
        g._waSock = undefined;
        g._waStarting = null;
        if (!loggedOut) {
          setTimeout(() => {
            startSocket().catch(() => {});
          }, 3000);
        }
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

  try {
    await rm(AUTH_DIR, { recursive: true, force: true });
  } catch {}
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
