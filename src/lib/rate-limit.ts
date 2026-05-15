type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: max - 1, resetAt: fresh.resetAt };
  }

  if (b.count >= max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }

  b.count += 1;
  return { ok: true, remaining: max - b.count, resetAt: b.resetAt };
}

export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
