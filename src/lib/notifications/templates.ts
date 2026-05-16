export type NotificationKind =
  | "ACCOUNT_CREATED"
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_BY_ADMIN"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "TASK_DUE"
  | "TASK_OVERDUE"
  | "SYSTEM_WHATSAPP_DOWN"
  | "SYSTEM_WHATSAPP_RECOVERED";

export type WhatsAppDownReason =
  | "CONNECTION_LOST"
  | "LOGGED_OUT"
  | "WAITING_QR_AGAIN";

export type RenderInput =
  | {
      kind: "ACCOUNT_CREATED";
      userName: string;
      tempPassword: string;
      loginUrl: string;
    }
  | {
      kind: "PASSWORD_RESET";
      userName: string;
      resetUrl: string;
      expiresInMinutes: number;
    }
  | {
      kind: "PASSWORD_RESET_BY_ADMIN";
      userName: string;
      tempPassword: string;
      loginUrl: string;
    }
  | {
      kind: "PAYMENT_DUE";
      userName: string;
      vendorName: string;
      amount: number;
      dueDate: Date;
      daysUntilDue: number;
    }
  | {
      kind: "PAYMENT_OVERDUE";
      userName: string;
      vendorName: string;
      amount: number;
      dueDate: Date;
      daysOverdue: number;
    }
  | {
      kind: "TASK_DUE";
      userName: string;
      taskTitle: string;
      deadline: Date;
      daysUntilDeadline: number;
    }
  | {
      kind: "TASK_OVERDUE";
      userName: string;
      taskTitle: string;
      deadline: Date;
      daysOverdue: number;
    }
  | {
      kind: "SYSTEM_WHATSAPP_DOWN";
      userName: string;
      reason: WhatsAppDownReason;
      attempts: number;
      lastError: string | null;
      settingsUrl: string;
    }
  | {
      kind: "SYSTEM_WHATSAPP_RECOVERED";
      userName: string;
      settingsUrl: string;
      downtimeMinutes: number;
    };

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
  waText: string;
};

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}

export function escapeWaMarkdown(value: string): string {
  return value.replace(/([*_~`])/g, "\\$1");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function wrapHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e4e4e7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:32px;">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px;color:#f4f4f5;">Wedding Finance</h1>
${body}
<p style="margin-top:32px;font-size:12px;color:#71717a;">Esta é uma mensagem automática do sistema. Não responda este email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function render(input: RenderInput): RenderedTemplate {
  switch (input.kind) {
    case "ACCOUNT_CREATED": {
      const name = escapeHtml(input.userName);
      const pwd = escapeHtml(input.tempPassword);
      const url = escapeHtml(input.loginUrl);
      const subject = "Sua conta no Wedding Finance foi criada";
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${name}</strong>!</p>
<p>Um administrador criou uma conta para você no Wedding Finance.</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>Senha temporária:</strong> <code style="font-size:16px;color:#fda4af;">${pwd}</code><br>
<small>Você será obrigado a trocar esta senha no primeiro acesso.</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Acessar o sistema</a></p>`,
      );
      const text = `Olá, ${input.userName}!

Um administrador criou uma conta para você no Wedding Finance.

Senha temporária: ${input.tempPassword}
(Você precisará trocar no primeiro acesso.)

Acesse: ${input.loginUrl}`;
      const waText = `*Wedding Finance*

Olá, ${escapeWaMarkdown(input.userName)}!

Um administrador criou uma conta para você.

🔑 *Senha temporária:* ${escapeWaMarkdown(input.tempPassword)}
_(será trocada no primeiro acesso)_

Acesse: ${input.loginUrl}`;
      return { subject, html, text, waText };
    }

    case "PASSWORD_RESET": {
      const name = escapeHtml(input.userName);
      const url = escapeHtml(input.resetUrl);
      const min = input.expiresInMinutes;
      const subject = "Redefinição de senha — Wedding Finance";
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${name}</strong>!</p>
<p>Recebemos um pedido para redefinir sua senha.</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Redefinir minha senha</a></p>
<p>O link expira em <strong>${min} minutos</strong>. Se você não solicitou, ignore este email.</p>`,
      );
      const text = `Olá, ${input.userName}!

Recebemos um pedido para redefinir sua senha no Wedding Finance.

Acesse o link abaixo (expira em ${min} minutos):
${input.resetUrl}

Se você não solicitou, ignore este email.`;
      const waText = `*Wedding Finance*

Olá, ${escapeWaMarkdown(input.userName)}!

Recebemos um pedido para redefinir sua senha.

🔗 ${input.resetUrl}

_O link expira em ${min} minutos._
_Se você não solicitou, ignore esta mensagem._`;
      return { subject, html, text, waText };
    }

    case "PASSWORD_RESET_BY_ADMIN": {
      const name = escapeHtml(input.userName);
      const pwd = escapeHtml(input.tempPassword);
      const url = escapeHtml(input.loginUrl);
      const subject = "Sua senha foi redefinida — Wedding Finance";
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${name}</strong>!</p>
<p>Um administrador redefiniu sua senha.</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>Senha temporária:</strong> <code style="font-size:16px;color:#fda4af;">${pwd}</code><br>
<small>Você será obrigado a trocá-la no próximo acesso.</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Acessar o sistema</a></p>`,
      );
      const text = `Olá, ${input.userName}!

Um administrador redefiniu sua senha.

Senha temporária: ${input.tempPassword}
(será trocada no próximo acesso)

Acesse: ${input.loginUrl}`;
      const waText = `*Wedding Finance*

Olá, ${escapeWaMarkdown(input.userName)}!

Um administrador redefiniu sua senha.

🔑 *Senha temporária:* ${escapeWaMarkdown(input.tempPassword)}
_(será trocada no próximo acesso)_

Acesse: ${input.loginUrl}`;
      return { subject, html, text, waText };
    }

    case "PAYMENT_DUE": {
      const vendor = escapeHtml(input.vendorName);
      const value = formatCurrency(input.amount);
      const date = formatDate(input.dueDate);
      const when =
        input.daysUntilDue <= 1
          ? "amanhã"
          : `em ${input.daysUntilDue} dias`;
      const subject = `Pagamento de ${vendor} vence ${when}`;
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${escapeHtml(input.userName)}</strong>!</p>
<p>Lembrete: pagamento vence <strong>${when}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<tr><td style="padding:8px 0;color:#a1a1aa;">Fornecedor</td><td style="padding:8px 0;text-align:right;">${vendor}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">Valor</td><td style="padding:8px 0;text-align:right;font-weight:600;">${value}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">Vencimento</td><td style="padding:8px 0;text-align:right;">${date}</td></tr>
</table>`,
      );
      const text = `Lembrete de pagamento

Fornecedor: ${input.vendorName}
Valor: ${value}
Vencimento: ${date} (${when})`;
      const waText = `*Wedding Finance*

💸 *Lembrete de pagamento*

Vence ${when}.

• Fornecedor: ${escapeWaMarkdown(input.vendorName)}
• Valor: ${value}
• Vencimento: ${date}`;
      return { subject, html, text, waText };
    }

    case "PAYMENT_OVERDUE": {
      const vendor = escapeHtml(input.vendorName);
      const value = formatCurrency(input.amount);
      const date = formatDate(input.dueDate);
      const subject = `Pagamento de ${vendor} está atrasado`;
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${escapeHtml(input.userName)}</strong>!</p>
<p style="color:#fda4af;"><strong>⚠️ Pagamento atrasado há ${input.daysOverdue} dia(s).</strong></p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<tr><td style="padding:8px 0;color:#a1a1aa;">Fornecedor</td><td style="padding:8px 0;text-align:right;">${vendor}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">Valor</td><td style="padding:8px 0;text-align:right;font-weight:600;">${value}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">Vencimento</td><td style="padding:8px 0;text-align:right;">${date}</td></tr>
</table>`,
      );
      const text = `⚠ Pagamento atrasado há ${input.daysOverdue} dia(s)

Fornecedor: ${input.vendorName}
Valor: ${value}
Vencimento: ${date}`;
      const waText = `*Wedding Finance*

⚠️ *Pagamento atrasado*

Atrasado há ${input.daysOverdue} dia(s).

• Fornecedor: ${escapeWaMarkdown(input.vendorName)}
• Valor: ${value}
• Vencimento: ${date}`;
      return { subject, html, text, waText };
    }

    case "TASK_DUE": {
      const title = escapeHtml(input.taskTitle);
      const date = formatDate(input.deadline);
      const when =
        input.daysUntilDeadline <= 1
          ? "amanhã"
          : `em ${input.daysUntilDeadline} dias`;
      const subject = `Tarefa vence ${when}: ${input.taskTitle}`;
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${escapeHtml(input.userName)}</strong>!</p>
<p>Lembrete: a tarefa abaixo vence <strong>${when}</strong>.</p>
<p style="background:#27272a;border-radius:8px;padding:16px;font-weight:600;">${title}</p>
<p style="color:#a1a1aa;">Prazo: ${date}</p>`,
      );
      const text = `Tarefa vence ${when}

${input.taskTitle}
Prazo: ${date}`;
      const waText = `*Wedding Finance*

📋 *Lembrete de tarefa*

Vence ${when}.

${escapeWaMarkdown(input.taskTitle)}
Prazo: ${date}`;
      return { subject, html, text, waText };
    }

    case "TASK_OVERDUE": {
      const title = escapeHtml(input.taskTitle);
      const date = formatDate(input.deadline);
      const subject = `Tarefa atrasada: ${input.taskTitle}`;
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${escapeHtml(input.userName)}</strong>!</p>
<p style="color:#fda4af;"><strong>⚠️ Tarefa atrasada há ${input.daysOverdue} dia(s).</strong></p>
<p style="background:#27272a;border-radius:8px;padding:16px;font-weight:600;">${title}</p>
<p style="color:#a1a1aa;">Prazo era: ${date}</p>`,
      );
      const text = `⚠ Tarefa atrasada há ${input.daysOverdue} dia(s)

${input.taskTitle}
Prazo era: ${date}`;
      const waText = `*Wedding Finance*

⚠️ *Tarefa atrasada*

Atrasada há ${input.daysOverdue} dia(s).

${escapeWaMarkdown(input.taskTitle)}
Prazo era: ${date}`;
      return { subject, html, text, waText };
    }

    case "SYSTEM_WHATSAPP_DOWN": {
      const name = escapeHtml(input.userName);
      const url = escapeHtml(input.settingsUrl);
      const errorLine = input.lastError
        ? `<p style="color:#a1a1aa;font-size:12px;">Último erro: <code>${escapeHtml(input.lastError)}</code></p>`
        : "";
      const errorPlain = input.lastError ? `\nÚltimo erro: ${input.lastError}` : "";

      let subject: string;
      let bodyHtml: string;
      let bodyText: string;

      if (input.reason === "LOGGED_OUT") {
        subject = "⚠ Ação necessária: WhatsApp desconectado";
        bodyHtml = `<p>Olá, <strong>${name}</strong>!</p>
<p style="color:#fda4af;"><strong>⚠️ A sessão do WhatsApp foi encerrada.</strong></p>
<p>Isso costuma acontecer quando alguém desvincula o aparelho pelo app oficial do WhatsApp. O sistema <strong>não consegue reconectar sozinho</strong> nesse caso — é preciso escanear um novo QR Code.</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Abrir configurações</a></p>
${errorLine}`;
        bodyText = `⚠ Ação necessária: WhatsApp desconectado

A sessão do WhatsApp foi encerrada. O sistema não consegue reconectar sozinho — é preciso escanear um novo QR Code.

Acesse: ${input.settingsUrl}${errorPlain}`;
      } else if (input.reason === "WAITING_QR_AGAIN") {
        subject = "⚠ Ação necessária: WhatsApp pediu novo QR Code";
        bodyHtml = `<p>Olá, <strong>${name}</strong>!</p>
<p style="color:#fda4af;"><strong>⚠️ O WhatsApp solicitou um novo QR Code.</strong></p>
<p>A sessão expirou ou foi invalidada. Para retomar os envios, abra as configurações e escaneie o QR.</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Abrir configurações</a></p>
${errorLine}`;
        bodyText = `⚠ Ação necessária: WhatsApp pediu novo QR Code

A sessão expirou ou foi invalidada. Abra as configurações e escaneie o QR para retomar os envios.

Acesse: ${input.settingsUrl}${errorPlain}`;
      } else {
        subject = "🔌 WhatsApp instável — tentando reconectar";
        bodyHtml = `<p>Olá, <strong>${name}</strong>!</p>
<p>A conexão com o WhatsApp caiu e o sistema está tentando reconectar automaticamente.</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>Tentativas até agora:</strong> ${input.attempts}<br>
<small>Se não voltar em alguns minutos, vale abrir o painel para verificar.</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Abrir configurações</a></p>
${errorLine}`;
        bodyText = `🔌 WhatsApp instável

A conexão caiu e o sistema está tentando reconectar automaticamente.
Tentativas: ${input.attempts}

Se não voltar em alguns minutos, abra: ${input.settingsUrl}${errorPlain}`;
      }

      const html = wrapHtml(subject, bodyHtml);
      const waText = `*Wedding Finance*\n\n${bodyText}`;
      return { subject, html, text: bodyText, waText };
    }

    case "SYSTEM_WHATSAPP_RECOVERED": {
      const name = escapeHtml(input.userName);
      const url = escapeHtml(input.settingsUrl);
      const subject = "✅ WhatsApp voltou";
      const minutesLabel =
        input.downtimeMinutes <= 1
          ? "menos de 1 minuto"
          : `${input.downtimeMinutes} minuto(s)`;
      const html = wrapHtml(
        subject,
        `<p>Olá, <strong>${name}</strong>!</p>
<p style="color:#86efac;"><strong>✅ A conexão com o WhatsApp foi restabelecida.</strong></p>
<p style="color:#a1a1aa;">Tempo fora do ar: ${minutesLabel}.</p>
<p><a href="${url}" style="display:inline-block;background:#27272a;color:#e4e4e7;padding:12px 24px;border-radius:8px;text-decoration:none;border:1px solid #3f3f46;">Abrir configurações</a></p>`,
      );
      const text = `✅ WhatsApp voltou

A conexão foi restabelecida.
Tempo fora do ar: ${minutesLabel}.

${input.settingsUrl}`;
      const waText = `*Wedding Finance*\n\n${text}`;
      return { subject, html, text, waText };
    }
  }
}
