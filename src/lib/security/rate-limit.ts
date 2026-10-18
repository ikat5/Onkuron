import "server-only";
import { RateLimit } from "@/models/RateLimit";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "login:ip". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * MongoDB-backed fixed-window rate limiter. The counter is incremented
 * atomically with an upsert, so limits hold across all server instances
 * (in-memory limiters would not in serverless or multi-instance deploys).
 */
export async function hit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000;
  const expiresAt = new Date(windowStart + rule.windowSeconds * 1000);
  const key = `${rule.name}:${identifier}:${windowStart}`;
  let doc;
  try {
    doc = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    ).lean();
  } catch (err) {
    // Two concurrent upserts can race on the unique index; the retry hits the existing doc.
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean();
  }
  const count = doc?.count ?? 1;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.ceil((expiresAt.getTime() - now) / 1000),
  };
}

/** Checks several rules; all are counted and the request is denied if any is exceeded. */
export async function hitAll(checks: Array<[RateLimitRule, string]>): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map(([rule, id]) => hit(rule, id)));
  const denied = results.filter((r) => !r.allowed);
  if (denied.length === 0) return { allowed: true, remaining: Math.min(...results.map((r) => r.remaining)), retryAfterSeconds: 0 };
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(...denied.map((r) => r.retryAfterSeconds)) };
}

export const RULES = {
  loginIp: { name: "login:ip", limit: 30, windowSeconds: 15 * 60 },
  loginAccount: { name: "login:acct", limit: 10, windowSeconds: 15 * 60 },
  registerIp: { name: "register:ip", limit: 5, windowSeconds: 60 * 60 },
  resendEmail: { name: "resend:email", limit: 3, windowSeconds: 60 * 60 },
  resendIp: { name: "resend:ip", limit: 10, windowSeconds: 60 * 60 },
  resendCooldown: { name: "resend:cooldown", limit: 1, windowSeconds: 60 },
  verifyIp: { name: "verify:ip", limit: 30, windowSeconds: 15 * 60 },
  forgotEmail: { name: "forgot:email", limit: 3, windowSeconds: 60 * 60 },
  forgotIp: { name: "forgot:ip", limit: 10, windowSeconds: 60 * 60 },
  enrollUser: { name: "enroll:user", limit: 10, windowSeconds: 60 * 60 },
  chatUser: { name: "chat:user", limit: 30, windowSeconds: 60 },
  uploadSign: { name: "upload:sign", limit: 60, windowSeconds: 60 * 60 },
  passwordChange: { name: "pwchange:user", limit: 5, windowSeconds: 15 * 60 },
  contactIp: { name: "contact:ip", limit: 5, windowSeconds: 60 * 60 },
  contactEmail: { name: "contact:email", limit: 3, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;
