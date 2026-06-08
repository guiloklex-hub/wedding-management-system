import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { formatCurrency, formatDate } from "@/i18n/format";
import { interpolateBaseTags } from "./std-message";

export type NotificationKind =
  | "ACCOUNT_CREATED"
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_BY_ADMIN"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "TASK_DUE"
  | "TASK_OVERDUE"
  | "GUEST_RSVP"
  | "SAVE_THE_DATE"
  | "RSVP_REMINDER"
  | "RSVP_REMINDER_GROUP"
  | "SYSTEM_WHATSAPP_DOWN"
  | "SYSTEM_WHATSAPP_RECOVERED";

export type WhatsAppDownReason =
  | "CONNECTION_LOST"
  | "LOGGED_OUT"
  | "WAITING_QR_AGAIN";

type WithLocale = { locale?: Locale };

export type RenderInput =
  | ({
      kind: "ACCOUNT_CREATED";
      userName: string;
      tempPassword: string;
      loginUrl: string;
    } & WithLocale)
  | ({
      kind: "PASSWORD_RESET";
      userName: string;
      resetUrl: string;
      expiresInMinutes: number;
    } & WithLocale)
  | ({
      kind: "PASSWORD_RESET_BY_ADMIN";
      userName: string;
      tempPassword: string;
      loginUrl: string;
    } & WithLocale)
  | ({
      kind: "PAYMENT_DUE";
      userName: string;
      vendorName: string;
      amount: number;
      currency?: string;
      dueDate: Date;
      daysUntilDue: number;
    } & WithLocale)
  | ({
      kind: "PAYMENT_OVERDUE";
      userName: string;
      vendorName: string;
      amount: number;
      currency?: string;
      dueDate: Date;
      daysOverdue: number;
    } & WithLocale)
  | ({
      kind: "TASK_DUE";
      userName: string;
      taskTitle: string;
      deadline: Date;
      daysUntilDeadline: number;
    } & WithLocale)
  | ({
      kind: "TASK_OVERDUE";
      userName: string;
      taskTitle: string;
      deadline: Date;
      daysOverdue: number;
    } & WithLocale)
  | ({
      kind: "GUEST_RSVP";
      userName: string;
      guestName: string;
      rsvpStatus: string;
      plusOnes?: number;
      groupName?: string | null;
    } & WithLocale)
  | ({
      kind: "SAVE_THE_DATE";
      coupleNames: string;
      eventDate: Date;
      venueName?: string | null;
      recipientNames: string;
      websiteUrl?: string | null;
      giftRegistryUrl?: string | null;
      customMessage?: string | null;
      imageCid?: string | null;
    } & WithLocale)
  | ({
      kind: "RSVP_REMINDER";
      userName: string;
      rsvpUrl: string;
      daysInvitedSince: number;
    } & WithLocale)
  | ({
      kind: "RSVP_REMINDER_GROUP";
      userName: string;
      memberNames: string;
      rsvpUrl: string;
      daysInvitedSince: number;
    } & WithLocale)
  | ({
      kind: "SYSTEM_WHATSAPP_DOWN";
      userName: string;
      reason: WhatsAppDownReason;
      attempts: number;
      lastError: string | null;
      settingsUrl: string;
    } & WithLocale)
  | ({
      kind: "SYSTEM_WHATSAPP_RECOVERED";
      userName: string;
      settingsUrl: string;
      downtimeMinutes: number;
    } & WithLocale);

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

function wrapHtml(title: string, body: string, locale: Locale, footer: string, header: string): string {
  const headerHtml = header
    ? `<h1 style="margin:0 0 16px;font-size:20px;color:#f4f4f5;">${escapeHtml(header)}</h1>`
    : "";
  const footerHtml = footer
    ? `<p style="margin-top:32px;font-size:12px;color:#71717a;">${escapeHtml(footer)}</p>`
    : "";
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e4e4e7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:32px;">
<tr><td>
${headerHtml}
${body}
${footerHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function render(input: RenderInput): Promise<RenderedTemplate> {
  const locale: Locale = input.locale ?? DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "notifications" });
  const moneyCurrency = "currency" in input && input.currency ? input.currency : "BRL";

  const header = t("common.header");
  const footer = t("common.automaticFooter");
  const userNameRaw = (input as { userName?: string }).userName ?? "";
  const safeName = escapeHtml(userNameRaw);
  const greetingHtml = t.markup("common.greeting", {
    name: safeName,
    strong: (chunks: string) => `<strong>${chunks}</strong>`,
  });
  const greetingText = t("common.greetingText", { name: userNameRaw });

  switch (input.kind) {
    case "ACCOUNT_CREATED": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`ACCOUNT_CREATED.${key}`, values);
      const pwd = escapeHtml(input.tempPassword);
      const url = escapeHtml(input.loginUrl);
      const subject = tk("subject");
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro"))}</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>${escapeHtml(tk("tempPasswordLabel"))}</strong> <code style="font-size:16px;color:#fda4af;">${pwd}</code><br>
<small>${escapeHtml(tk("tempPasswordHint"))}</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("cta"))}</a></p>`,
        locale,
        footer,
        header,
      );
      const text = `${greetingText}

${tk("textIntro")}

${tk("textPassword", { password: input.tempPassword })}
${tk("textHint")}

${tk("textAccess", { url: input.loginUrl })}`;
      const waText = `*${header}*

${greetingText}

${tk("textIntro")}

${tk("waPassword", { password: escapeWaMarkdown(input.tempPassword) })}
${tk("waHint")}

${tk("textAccess", { url: input.loginUrl })}`;
      return { subject, html, text, waText };
    }

    case "PASSWORD_RESET": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`PASSWORD_RESET.${key}`, values);
      const url = escapeHtml(input.resetUrl);
      const min = input.expiresInMinutes;
      const subject = tk("subject");
      const expiresHtml = t.markup("PASSWORD_RESET.expiresIn", {
        minutes: min,
        strong: (chunks: string) => `<strong>${chunks}</strong>`,
      });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro"))}</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("cta"))}</a></p>
<p>${expiresHtml}</p>`,
        locale,
        footer,
        header,
      );
      const text = `${greetingText}

${tk("textIntro")}

${tk("textExpires", { minutes: min })}
${input.resetUrl}

${tk("textIgnore")}`;
      const waText = `*${header}*

${greetingText}

${tk("waIntro")}

🔗 ${input.resetUrl}

${tk("waExpires", { minutes: min })}
${tk("waIgnore")}`;
      return { subject, html, text, waText };
    }

    case "PASSWORD_RESET_BY_ADMIN": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`PASSWORD_RESET_BY_ADMIN.${key}`, values);
      const pwd = escapeHtml(input.tempPassword);
      const url = escapeHtml(input.loginUrl);
      const subject = tk("subject");
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro"))}</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>${escapeHtml(tk("tempPasswordLabel"))}</strong> <code style="font-size:16px;color:#fda4af;">${pwd}</code><br>
<small>${escapeHtml(tk("tempPasswordHint"))}</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("cta"))}</a></p>`,
        locale,
        footer,
        header,
      );
      const text = `${greetingText}

${tk("intro")}

${tk("textPassword", { password: input.tempPassword })}
${tk("textHint")}

${input.loginUrl}`;
      const waText = `*${header}*

${greetingText}

${tk("intro")}

🔑 *${tk("tempPasswordLabel")}* ${escapeWaMarkdown(input.tempPassword)}
${tk("waHint")}

${input.loginUrl}`;
      return { subject, html, text, waText };
    }

    case "PAYMENT_DUE": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`PAYMENT_DUE.${key}`, values);
      const vendor = escapeHtml(input.vendorName);
      const value = formatCurrency(input.amount, moneyCurrency, locale);
      const date = formatDate(input.dueDate, locale, {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const tomorrow = input.daysUntilDue <= 1;
      const subject = tomorrow
        ? tk("subjectTomorrow", { vendor: input.vendorName })
        : tk("subjectInDays", { vendor: input.vendorName, days: input.daysUntilDue });
      const reminder = tomorrow
        ? t.markup("PAYMENT_DUE.reminderTomorrow", { strong: (c: string) => `<strong>${c}</strong>` })
        : t.markup("PAYMENT_DUE.reminderInDays", {
            days: input.daysUntilDue,
            strong: (c: string) => `<strong>${c}</strong>`,
          });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${reminder}</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("vendorLabel"))}</td><td style="padding:8px 0;text-align:right;">${vendor}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("amountLabel"))}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${value}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("dueLabel"))}</td><td style="padding:8px 0;text-align:right;">${date}</td></tr>
</table>`,
        locale,
        footer,
        header,
      );
      const dueLine = tomorrow
        ? tk("textDueTomorrow", { date })
        : tk("textDueInDays", { date, days: input.daysUntilDue });
      const text = `${tk("textTitle")}

${tk("textVendor", { vendor: input.vendorName })}
${tk("textAmount", { value })}
${dueLine}`;
      const whenWa = tomorrow ? tk("waWhenTomorrow") : tk("waWhenInDays", { days: input.daysUntilDue });
      const waText = `*${header}*

${tk("waTitle")}

${whenWa}

• ${tk("vendorLabel")}: ${escapeWaMarkdown(input.vendorName)}
• ${tk("amountLabel")}: ${value}
• ${tk("dueLabel")}: ${date}`;
      return { subject, html, text, waText };
    }

    case "PAYMENT_OVERDUE": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`PAYMENT_OVERDUE.${key}`, values);
      const vendor = escapeHtml(input.vendorName);
      const value = formatCurrency(input.amount, moneyCurrency, locale);
      const date = formatDate(input.dueDate, locale, {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const subject = tk("subject", { vendor: input.vendorName });
      const banner = tk("overdueBanner", { days: input.daysOverdue });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p style="color:#fda4af;"><strong>${escapeHtml(banner)}</strong></p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("vendorLabel"))}</td><td style="padding:8px 0;text-align:right;">${vendor}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("amountLabel"))}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${value}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("dueLabel"))}</td><td style="padding:8px 0;text-align:right;">${date}</td></tr>
</table>`,
        locale,
        footer,
        header,
      );
      const text = `${tk("textTitle", { days: input.daysOverdue })}

${t("PAYMENT_DUE.textVendor", { vendor: input.vendorName })}
${t("PAYMENT_DUE.textAmount", { value })}
${t("PAYMENT_DUE.dueLabel")}: ${date}`;
      const waText = `*${header}*

${tk("waTitle")}

${tk("waSubtitle", { days: input.daysOverdue })}

• ${tk("vendorLabel")}: ${escapeWaMarkdown(input.vendorName)}
• ${tk("amountLabel")}: ${value}
• ${tk("dueLabel")}: ${date}`;
      return { subject, html, text, waText };
    }

    case "TASK_DUE": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`TASK_DUE.${key}`, values);
      const title = escapeHtml(input.taskTitle);
      const date = formatDate(input.deadline, locale, {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const tomorrow = input.daysUntilDeadline <= 1;
      const subject = tomorrow
        ? tk("subjectTomorrow", { title: input.taskTitle })
        : tk("subjectInDays", { days: input.daysUntilDeadline, title: input.taskTitle });
      const reminder = tomorrow
        ? t.markup("TASK_DUE.reminderTomorrow", { strong: (c: string) => `<strong>${c}</strong>` })
        : t.markup("TASK_DUE.reminderInDays", {
            days: input.daysUntilDeadline,
            strong: (c: string) => `<strong>${c}</strong>`,
          });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${reminder}</p>
<p style="background:#27272a;border-radius:8px;padding:16px;font-weight:600;">${title}</p>
<p style="color:#a1a1aa;">${escapeHtml(tk("deadlineLabel", { date }))}</p>`,
        locale,
        footer,
        header,
      );
      const text = `${
        tomorrow
          ? tk("textTitleTomorrow")
          : tk("textTitleInDays", { days: input.daysUntilDeadline })
      }

${input.taskTitle}
${tk("deadlineLabel", { date })}`;
      const whenWa = tomorrow ? tk("waWhenTomorrow") : tk("waWhenInDays", { days: input.daysUntilDeadline });
      const waText = `*${header}*

${tk("waTitle")}

${whenWa}

${escapeWaMarkdown(input.taskTitle)}
${tk("waDeadline", { date })}`;
      return { subject, html, text, waText };
    }

    case "TASK_OVERDUE": {
      const tk = (key: string, values?: Record<string, string | number | Date>) => t(`TASK_OVERDUE.${key}`, values);
      const title = escapeHtml(input.taskTitle);
      const date = formatDate(input.deadline, locale, {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const subject = tk("subject", { title: input.taskTitle });
      const banner = tk("overdueBanner", { days: input.daysOverdue });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p style="color:#fda4af;"><strong>${escapeHtml(banner)}</strong></p>
<p style="background:#27272a;border-radius:8px;padding:16px;font-weight:600;">${title}</p>
<p style="color:#a1a1aa;">${escapeHtml(tk("deadlineWasLabel", { date }))}</p>`,
        locale,
        footer,
        header,
      );
      const text = `${tk("textTitle", { days: input.daysOverdue })}

${input.taskTitle}
${tk("deadlineWasLabel", { date })}`;
      const waText = `*${header}*

${tk("waTitle")}

${tk("waSubtitle", { days: input.daysOverdue })}

${escapeWaMarkdown(input.taskTitle)}
${tk("waDeadlineWas", { date })}`;
      return { subject, html, text, waText };
    }

    case "GUEST_RSVP": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`GUEST_RSVP.${key}`, values);
      const guest = escapeHtml(input.guestName);
      const statusLabel = tk(`status.${input.rsvpStatus}`);
      const safeStatus = escapeHtml(statusLabel);
      const subject = tk("subject", { guest: input.guestName });
      const groupRow = input.groupName
        ? `<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("groupLabel"))}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(input.groupName)}</td></tr>`
        : "";
      const plusRow =
        input.plusOnes && input.plusOnes > 0
          ? `<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("plusOnesLabel"))}</td><td style="padding:8px 0;text-align:right;">${input.plusOnes}</td></tr>`
          : "";
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro", { guest: input.guestName }))}</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("guestLabel"))}</td><td style="padding:8px 0;text-align:right;">${guest}</td></tr>
<tr><td style="padding:8px 0;color:#a1a1aa;">${escapeHtml(tk("statusLabel"))}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${safeStatus}</td></tr>
${groupRow}
${plusRow}
</table>`,
        locale,
        footer,
        header,
      );
      const groupText = input.groupName ? `\n${tk("groupLabel")}: ${input.groupName}` : "";
      const plusText =
        input.plusOnes && input.plusOnes > 0 ? `\n${tk("plusOnesLabel")}: ${input.plusOnes}` : "";
      const text = `${tk("intro", { guest: input.guestName })}

${tk("guestLabel")}: ${input.guestName}
${tk("statusLabel")}: ${statusLabel}${groupText}${plusText}`;
      const waGroup = input.groupName ? `\n• ${tk("groupLabel")}: ${escapeWaMarkdown(input.groupName)}` : "";
      const waText = `*${header}*

${tk("intro", { guest: escapeWaMarkdown(input.guestName) })}

• ${tk("guestLabel")}: ${escapeWaMarkdown(input.guestName)}
• ${tk("statusLabel")}: ${statusLabel}${waGroup}`;
      return { subject, html, text, waText };
    }

    case "SAVE_THE_DATE": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`SAVE_THE_DATE.${key}`, values);
      const dateStr = formatDate(input.eventDate, locale, {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const names = input.coupleNames;
      const guests = input.recipientNames;
      const venue = input.venueName ?? null;

      const websiteUrl = input.websiteUrl ?? null;
      const registryUrl = input.giftRegistryUrl ?? null;

      let bodyCore: string;
      const custom = input.customMessage?.trim();
      if (custom) {
        bodyCore = interpolateBaseTags(custom, {
          nomes: names,
          convidados: guests,
          data: dateStr,
          local: venue ?? "",
        });
      } else {
        const parts = [
          tk("greeting", { guests }),
          "",
          tk("announce", { names }),
          venue ? tk("whenWhere", { date: dateStr, venue }) : tk("when", { date: dateStr }),
          "",
          tk("signoff", { names }),
        ];
        bodyCore = parts.join("\n");
      }

      const subject = tk("subject", { names });

      // WhatsApp / texto: {site} e {site-presentes} entram inline; o que não foi
      // usado inline é anexado no fim (compatível com mensagens antigas).
      let usedSite = false;
      let usedRegistry = false;
      let bodyText = bodyCore.replace(/\{site-presentes\}/g, () => {
        usedRegistry = true;
        return registryUrl ?? "";
      });
      bodyText = bodyText.replace(/\{site\}/g, () => {
        usedSite = true;
        return websiteUrl ?? "";
      });
      const waLinks: string[] = [];
      if (websiteUrl && !usedSite) waLinks.push(`• ${tk("websiteLabel")}: ${websiteUrl}`);
      if (registryUrl && !usedRegistry) waLinks.push(`• ${tk("registryLabel")}: ${registryUrl}`);
      const waText = `${bodyText}${waLinks.length ? `\n\n${waLinks.join("\n")}` : ""}`.trim();
      const text = waText;

      // HTML: escapa o corpo (com os tokens {site} ainda intactos) e troca os
      // tokens por âncoras já depois do escape.
      const anchor = (url: string) =>
        `<a href="${escapeHtml(url)}" style="color:#fda4af;">${escapeHtml(url)}</a>`;
      let usedSiteHtml = false;
      let usedRegistryHtml = false;
      let bodyHtmlCore = escapeHtml(bodyCore).replace(/\{site-presentes\}/g, () => {
        usedRegistryHtml = true;
        return registryUrl ? anchor(registryUrl) : "";
      });
      bodyHtmlCore = bodyHtmlCore.replace(/\{site\}/g, () => {
        usedSiteHtml = true;
        return websiteUrl ? anchor(websiteUrl) : "";
      });
      const bodyHtml = bodyHtmlCore.replace(/\n/g, "<br>");
      const linkRows: string[] = [];
      if (websiteUrl && !usedSiteHtml) {
        linkRows.push(
          `<p style="margin:4px 0;"><strong>${escapeHtml(tk("websiteLabel"))}:</strong> ${anchor(websiteUrl)}</p>`,
        );
      }
      if (registryUrl && !usedRegistryHtml) {
        linkRows.push(
          `<p style="margin:4px 0;"><strong>${escapeHtml(tk("registryLabel"))}:</strong> ${anchor(registryUrl)}</p>`,
        );
      }
      const imageHtml = input.imageCid
        ? `<p style="text-align:center;margin:0 0 20px;"><img src="cid:${escapeHtml(input.imageCid)}" alt="Save the Date" style="max-width:100%;border-radius:12px;"></p>`
        : "";
      // Sem o nome do sistema: cabeçalho = nomes do casal, sem rodapé automático.
      const html = wrapHtml(
        subject,
        `${imageHtml}<p style="font-size:16px;line-height:1.6;">${bodyHtml}</p>${linkRows.join("")}`,
        locale,
        "",
        names,
      );
      return { subject, html, text, waText };
    }

    case "SYSTEM_WHATSAPP_DOWN": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`SYSTEM_WHATSAPP_DOWN.${key}`, values);
      const url = escapeHtml(input.settingsUrl);
      const errorLine = input.lastError
        ? `<p style="color:#a1a1aa;font-size:12px;">${escapeHtml(
            tk("lastErrorLabel", { error: input.lastError }),
          )}</p>`
        : "";
      const errorPlain = input.lastError
        ? `\n${tk("lastErrorLabel", { error: input.lastError })}`
        : "";

      let subject: string;
      let bodyHtml: string;
      let bodyText: string;

      if (input.reason === "LOGGED_OUT") {
        subject = tk("subjectLoggedOut");
        bodyHtml = `<p>${greetingHtml}</p>
<p style="color:#fda4af;"><strong>${escapeHtml(tk("loggedOutBanner"))}</strong></p>
<p>${tk("loggedOutBody")}</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("openSettings"))}</a></p>
${errorLine}`;
        bodyText = `${tk("textLoggedOut")}\n\n${tk("openSettings")}: ${input.settingsUrl}${errorPlain}`;
      } else if (input.reason === "WAITING_QR_AGAIN") {
        subject = tk("subjectWaitingQr");
        bodyHtml = `<p>${greetingHtml}</p>
<p style="color:#fda4af;"><strong>${escapeHtml(tk("waitingQrBanner"))}</strong></p>
<p>${escapeHtml(tk("waitingQrBody"))}</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("openSettings"))}</a></p>
${errorLine}`;
        bodyText = `${tk("textWaitingQr")}\n\n${tk("openSettings")}: ${input.settingsUrl}${errorPlain}`;
      } else {
        subject = tk("subjectConnectionLost");
        bodyHtml = `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("connectionLostBody"))}</p>
<p style="background:#27272a;border-radius:8px;padding:16px;">
<strong>${escapeHtml(tk("attemptsLabel", { attempts: input.attempts }))}</strong><br>
<small>${escapeHtml(tk("attemptsHint"))}</small>
</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("openSettings"))}</a></p>
${errorLine}`;
        bodyText = `${tk("textConnectionLost", {
          attempts: input.attempts,
          url: input.settingsUrl,
        })}${errorPlain}`;
      }

      const html = wrapHtml(subject, bodyHtml, locale, footer, header);
      const waText = `*${header}*\n\n${bodyText}`;
      return { subject, html, text: bodyText, waText };
    }

    case "SYSTEM_WHATSAPP_RECOVERED": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`SYSTEM_WHATSAPP_RECOVERED.${key}`, values);
      const url = escapeHtml(input.settingsUrl);
      const subject = tk("subject");
      const downtime =
        input.downtimeMinutes <= 1
          ? tk("downtimeLessThanMinute")
          : tk("downtimeMinutes", { minutes: input.downtimeMinutes });
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p style="color:#86efac;"><strong>${escapeHtml(tk("banner"))}</strong></p>
<p style="color:#a1a1aa;">${escapeHtml(downtime)}</p>
<p><a href="${url}" style="display:inline-block;background:#27272a;color:#e4e4e7;padding:12px 24px;border-radius:8px;text-decoration:none;border:1px solid #3f3f46;">${escapeHtml(tk("openSettings"))}</a></p>`,
        locale,
        footer,
        header,
      );
      const text = `${tk("text")}\n${downtime}\n\n${input.settingsUrl}`;
      const waText = `*${header}*\n\n${text}`;
      return { subject, html, text, waText };
    }

    case "RSVP_REMINDER": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`RSVP_REMINDER.${key}`, values);
      const url = escapeHtml(input.rsvpUrl);
      const days = input.daysInvitedSince;
      const subject = tk("subject");
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro", { days }))}</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("cta"))}</a></p>`,
        locale,
        footer,
        header,
      );
      const text = `${greetingText}

${tk("intro", { days })}

${tk("cta")}: ${input.rsvpUrl}`;
      const waText = `*${tk("waTitle")}*

${greetingText}

${tk("waIntro", { days })}
${input.rsvpUrl}`;
      return { subject, html, text, waText };
    }

    case "RSVP_REMINDER_GROUP": {
      const tk = (key: string, values?: Record<string, string | number | Date>) =>
        t(`RSVP_REMINDER_GROUP.${key}`, values);
      const url = escapeHtml(input.rsvpUrl);
      const days = input.daysInvitedSince;
      const subject = tk("subject");
      const html = wrapHtml(
        subject,
        `<p>${greetingHtml}</p>
<p>${escapeHtml(tk("intro", { members: input.memberNames, days }))}</p>
<p><a href="${url}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">${escapeHtml(tk("cta"))}</a></p>`,
        locale,
        footer,
        header,
      );
      const text = `${greetingText}

${tk("intro", { members: input.memberNames, days })}

${tk("cta")}: ${input.rsvpUrl}`;
      const waText = `*${tk("waTitle")}*

${greetingText}

${tk("waIntro", { members: escapeWaMarkdown(input.memberNames), days })}
${input.rsvpUrl}`;
      return { subject, html, text, waText };
    }
  }
}
