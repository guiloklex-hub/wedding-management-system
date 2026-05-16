/**
 * Late-fee + interest helpers for overdue payments.
 *
 * Convention: late fee is a one-shot percent on the original amount applied as
 * soon as `dueDate` is in the past. Interest is a per-month percent applied
 * proportionally to the number of overdue days (lateDays / 30).
 *
 * All arithmetic happens in integer cents to avoid floating-point drift,
 * then converted back to BRL on the way out.
 */

export type PaymentLike = {
  amount: number;
  dueDate: Date;
  paidAt?: Date | null;
  status?: string | null;
  lateFeePercent?: number | null;
  interestPercentPerMonth?: number | null;
};

export type AdjustmentResult = {
  amount: number; // original amount (BRL)
  adjusted: number; // amount + lateFee + interest (BRL, 2 decimals)
  lateDays: number; // 0 when not overdue
  lateFee: number; // BRL
  interest: number; // BRL
  hasAdjustment: boolean;
};

function round2(cents: number): number {
  return Math.round(cents) / 100;
}

function dayDiff(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.ceil(ms / 86_400_000);
}

export function computeAdjustedAmount(
  payment: PaymentLike,
  today: Date = new Date(),
): AdjustmentResult {
  const baseCents = Math.round(payment.amount * 100);
  const empty: AdjustmentResult = {
    amount: payment.amount,
    adjusted: payment.amount,
    lateDays: 0,
    lateFee: 0,
    interest: 0,
    hasAdjustment: false,
  };

  if (payment.paidAt) return empty;
  if (payment.status === "PAID") return empty;

  const lateDays = dayDiff(today, payment.dueDate);
  if (lateDays <= 0) return empty;

  const feePct = payment.lateFeePercent ?? 0;
  const interestPct = payment.interestPercentPerMonth ?? 0;
  if (feePct <= 0 && interestPct <= 0) {
    return { ...empty, lateDays };
  }

  const feeCents = Math.round((baseCents * feePct) / 100);
  const interestCents = Math.round((baseCents * interestPct * lateDays) / (100 * 30));
  const adjustedCents = baseCents + feeCents + interestCents;

  return {
    amount: payment.amount,
    adjusted: round2(adjustedCents),
    lateDays,
    lateFee: round2(feeCents),
    interest: round2(interestCents),
    hasAdjustment: feeCents > 0 || interestCents > 0,
  };
}
