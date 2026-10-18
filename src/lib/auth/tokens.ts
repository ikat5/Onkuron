import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { AuthToken, type TokenPurpose } from "@/models/AuthToken";

/** 32 random bytes from the CSPRNG, base64url encoded (256 bits of entropy). */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a fresh single-use token. Policy: issuing a new token invalidates all
 * previously issued, unused tokens of the same purpose for that user.
 * Returns the raw token, which is only ever placed in the outgoing email.
 */
export async function issueToken(userId: Types.ObjectId, purpose: TokenPurpose, ttlMinutes: number) {
  await AuthToken.deleteMany({ userId, purpose, usedAt: { $exists: false } });
  const raw = generateRawToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await AuthToken.create({ userId, purpose, tokenHash: hashToken(raw), expiresAt });
  return { raw, expiresAt };
}

/**
 * Atomically consumes a token: only one concurrent caller can mark it used,
 * and expired or previously used tokens never match.
 */
export async function consumeToken(raw: string, purpose: TokenPurpose) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(raw)) return null;
  return AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(raw), purpose, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
}

/** Non-consuming check, used to render the confirmation page. */
export async function peekToken(raw: string, purpose: TokenPurpose) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(raw)) return null;
  return AuthToken.findOne({
    tokenHash: hashToken(raw),
    purpose,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).lean();
}
