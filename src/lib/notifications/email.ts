import nodemailer, { type Transporter } from "nodemailer";

type EmailGlobals = {
  _emailTransporter?: Transporter;
};
const g = globalThis as unknown as EmailGlobals;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !portStr || !user || !pass) return null;

  if (g._emailTransporter) return g._emailTransporter;

  const port = Number(portStr);
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465 ? true : false;

  g._emailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return g._emailTransporter;
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP não configurado" };
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;

  try {
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        ...(a.cid ? { cid: a.cid } : {}),
      })),
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}
