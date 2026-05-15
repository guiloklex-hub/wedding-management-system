type ICalEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  date: Date;
  allDay?: boolean;
  url?: string | null;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildICS(events: ICalEvent[], calendarName = "Wedding Finance"): string {
  const now = formatDateUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Finance//PT-BR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calendarName)}`,
  ];
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}@wedding-finance`);
    lines.push(`DTSTAMP:${now}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(ev.date)}`);
      const dayAfter = new Date(ev.date.getTime());
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(dayAfter)}`);
    } else {
      lines.push(`DTSTART:${formatDateUtc(ev.date)}`);
      const end = new Date(ev.date.getTime() + 30 * 60 * 1000);
      lines.push(`DTEND:${formatDateUtc(end)}`);
    }
    lines.push(`SUMMARY:${escape(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
    if (ev.url) lines.push(`URL:${escape(ev.url)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
