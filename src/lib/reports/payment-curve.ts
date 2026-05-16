import { isoDate } from "./formatters";

export type PaymentCurvePoint = {
  date: string;
  plannedCum: number;
  paidCum: number;
  lowerBand: number;
  upperBand: number;
};

type PaymentRow = {
  amount: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
};

export function buildPaymentSCurve(
  payments: PaymentRow[],
  contingencyPercent: number,
  options?: { from?: Date; to?: Date },
): PaymentCurvePoint[] {
  if (!payments.length) return [];

  const events: { date: Date; planned: number; paid: number }[] = [];
  for (const p of payments) {
    if (p.dueDate) {
      events.push({ date: p.dueDate, planned: p.amount, paid: 0 });
    }
    if (p.paidAt && p.status === "PAID") {
      events.push({ date: p.paidAt, planned: 0, paid: p.amount });
    }
  }
  if (!events.length) return [];

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  const minDate = options?.from ?? events[0].date;
  const maxDate = options?.to ?? events[events.length - 1].date;

  const buckets = new Map<string, { planned: number; paid: number }>();
  for (const e of events) {
    if (e.date < minDate || e.date > maxDate) continue;
    const key = isoDate(e.date);
    const cur = buckets.get(key) ?? { planned: 0, paid: 0 };
    cur.planned += e.planned;
    cur.paid += e.paid;
    buckets.set(key, cur);
  }

  const sortedKeys = Array.from(buckets.keys()).sort();
  const out: PaymentCurvePoint[] = [];
  let plannedCum = 0;
  let paidCum = 0;
  const band = Math.max(0, contingencyPercent) / 100;
  for (const key of sortedKeys) {
    const cur = buckets.get(key)!;
    plannedCum += cur.planned;
    paidCum += cur.paid;
    out.push({
      date: key,
      plannedCum,
      paidCum,
      lowerBand: plannedCum * (1 - band),
      upperBand: plannedCum * (1 + band),
    });
  }
  return out;
}
