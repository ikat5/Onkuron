import "server-only";
import { Types } from "mongoose";
import { getAppUrl, getAuthEnv, ConfigError } from "@/lib/env";
import { AppError, badRequest, serviceUnavailable, tooManyRequests, unauthorized } from "@/lib/errors";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { hitAll, RULES } from "@/lib/security/rate-limit";
import { EmailDeliveryError, isEmailConfigured, sendEmailNow } from "@/lib/email/service";
import { dispatchSoon, enqueueEmail } from "@/lib/email/outbox";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AuthToken } from "@/models/AuthToken";
import { User } from "@/models/User";
import type { RegisterInput } from "@/lib/validation";

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

async function enforce(checks: Parameters<typeof hitAll>[0]) {
  const r = await hitAll(checks);
  if (!r.allowed) throw tooManyRequests(r.retryAfterSeconds);
}

function requireEmail() {
  if (!isEmailConfigured()) {
    throw serviceUnavailable(
      "Email delivery is not configured on this server, so verification emails cannot be sent. Please contact the administrator.",
    );
  }
}

/** Sends a verification link. Raw tokens go straight into the email and are never persisted or logged. */
async function sendVerificationLink(user: { _id: Types.ObjectId; name: string; email: string }) {
  const ttl = getAuthEnv().VERIFICATION_TOKEN_TTL_MINUTES;
  const { raw } = await issueToken(user._id, "email_verification", ttl);
  const link = `${getAppUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
  await sendEmailNow("verify_email", user.email, {
    name: user.name,
    link,
    expiresInHours: Math.round((ttl / 60) * 10) / 10,
  });
}

function deliveryFailed(err: unknown): never {
  if (err instanceof EmailDeliveryError || err instanceof ConfigError) {
    throw new AppError(
      502,
      "email_failed",
      "We couldn't send the email right now. Please try again in a few minutes using “Resend verification email”.",
    );
  }
  throw err;
}

export const GENERIC_REGISTER_MESSAGE =
  "Check your inbox: if this email can be registered, we've sent a verification link to it.";

/**
 * Registers a student in the unverified state and emails a verification link.
 * The response is identical whether or not the email already has an account.
 */
export async function registerStudent(input: RegisterInput, ip: string) {
  await enforce([[RULES.registerIp, ip]]);
  requireEmail();

  // Hash first so every branch takes comparable time.
  const passwordHash = await hashPassword(input.password);
  const existing = await User.findOne({ email: input.email }).select("name email role emailVerified").lean();

  if (existing?.emailVerified || existing?.role === "teacher") {
    // Tell the real owner; don't reveal anything to the requester.
    const hour = Math.floor(Date.now() / 3_600_000);
    const { id } = await enqueueEmail({
      idempotencyKey: `registration_attempt:${existing._id}:${hour}`,
      template: "registration_attempt",
      to: existing.email,
      data: { name: existing.name },
    });
    dispatchSoon([id]);
    await audit({ action: "auth.register_existing", actorRole: "anonymous", targetType: "user", targetId: String(existing._id), ip });
    return { message: GENERIC_REGISTER_MESSAGE };
  }

  let user: { _id: Types.ObjectId; name: string; email: string };
  if (existing) {
    // Unverified account: the latest registration wins; only the inbox owner can verify it.
    const cooldown = await hitAll([[RULES.resendCooldown, input.email]]);
    await User.updateOne(
      { _id: existing._id, emailVerified: false },
      { $set: { name: input.name, phone: input.phone, passwordHash } },
    );
    user = { _id: existing._id, name: input.name, email: existing.email };
    if (!cooldown.allowed) return { message: GENERIC_REGISTER_MESSAGE };
  } else {
    try {
      const created = await User.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: "student",
        emailVerified: false,
      });
      user = { _id: created._id, name: created.name, email: created.email };
      await hitAll([[RULES.resendCooldown, input.email]]);
      await audit({ action: "auth.register", actorRole: "anonymous", targetType: "user", targetId: String(created._id), ip });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return { message: GENERIC_REGISTER_MESSAGE };
      throw err;
    }
  }

  try {
    await sendVerificationLink(user);
  } catch (err) {
    deliveryFailed(err);
  }
  return { message: GENERIC_REGISTER_MESSAGE };
}

export async function verifyEmail(rawToken: string, ip: string) {
  await enforce([[RULES.verifyIp, ip]]);
  const token = await consumeToken(rawToken, "email_verification");
  if (!token) {
    await audit({ action: "auth.verify_failed", actorRole: "anonymous", ip });
    throw badRequest("This verification link is invalid, has expired, or was already used.");
  }
  const user = await User.findOneAndUpdate(
    { _id: token.userId },
    { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!user) throw badRequest("This verification link is invalid, has expired, or was already used.");

  await AuthToken.deleteMany({ userId: user._id, purpose: "email_verification", usedAt: { $exists: false } });
  const { id } = await enqueueEmail({
    idempotencyKey: `email_verified:${user._id}`,
    template: "email_verified",
    to: user.email,
    data: { name: user.name },
  });
  dispatchSoon([id]);
  await audit({ action: "auth.email_verified", actor: { id: String(user._id), role: user.role }, targetType: "user", targetId: String(user._id), ip });
  return { email: user.email };
}

export const GENERIC_RESEND_MESSAGE =
  "If an unverified account exists for this email, a new verification link has been sent. Previous links no longer work.";

export async function resendVerification(email: string, ip: string) {
  await enforce([
    [RULES.resendIp, ip],
    [RULES.resendEmail, email],
  ]);
  requireEmail();
  const cooldown = await hitAll([[RULES.resendCooldown, email]]);
  if (!cooldown.allowed) throw tooManyRequests(cooldown.retryAfterSeconds);

  const user = await User.findOne({ email }).select("name email emailVerified role").lean();
  if (!user || user.emailVerified || user.role !== "student") {
    logger.info("auth.resend_noop");
    return { message: GENERIC_RESEND_MESSAGE };
  }
  try {
    await sendVerificationLink(user);
  } catch (err) {
    deliveryFailed(err);
  }
  await audit({ action: "auth.verification_resent", actorRole: "anonymous", targetType: "user", targetId: String(user._id), ip });
  return { message: GENERIC_RESEND_MESSAGE };
}

const INVALID_LOGIN = "Incorrect email or password.";

export async function login(email: string, password: string, ip: string) {
  await enforce([
    [RULES.loginIp, ip],
    [RULES.loginAccount, email],
  ]);

  const user = await User.findOne({ email }).select("+passwordHash").lean();
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    await audit({ action: "auth.login_failed", actorRole: "anonymous", ip, metadata: { reason: "unknown_account" } });
    throw unauthorized(INVALID_LOGIN);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    await audit({ action: "auth.login_locked", actorRole: "anonymous", targetType: "user", targetId: String(user._id), ip });
    throw tooManyRequests(Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000));
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedLoginCount: 1 } },
      { returnDocument: "after" },
    ).lean();
    if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await User.updateOne(
        { _id: user._id },
        { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedLoginCount: 0 } },
      );
      logger.warn("auth.account_locked", { userId: String(user._id) });
    }
    await audit({ action: "auth.login_failed", actorRole: "anonymous", targetType: "user", targetId: String(user._id), ip, metadata: { reason: "bad_password" } });
    throw unauthorized(INVALID_LOGIN);
  }

  if (!user.emailVerified) {
    // Only revealed after a correct password, so it doesn't enable account enumeration.
    throw new AppError(403, "email_unverified", "Please verify your email address before signing in. Check your inbox or request a new link.");
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockUntil: 1 } });
  const session = await signSession({ sub: String(user._id), role: user.role, sv: user.sessionVersion ?? 0 });
  await audit({ action: "auth.login", actor: { id: String(user._id), role: user.role }, ip });
  return { ...session, user: { id: String(user._id), name: user.name, role: user.role } };
}

export const GENERIC_FORGOT_MESSAGE = "If an account exists for this email, we've sent a password reset link.";

export async function forgotPassword(email: string, ip: string) {
  await enforce([
    [RULES.forgotIp, ip],
    [RULES.forgotEmail, email],
  ]);
  requireEmail();
  const user = await User.findOne({ email }).select("name email emailVerified role").lean();
  // The shared teacher password is rotated via settings or `npm run seed:teacher -- --rotate-password`.
  if (!user || !user.emailVerified || user.role !== "student") return { message: GENERIC_FORGOT_MESSAGE };

  const ttl = getAuthEnv().PASSWORD_RESET_TOKEN_TTL_MINUTES;
  const { raw } = await issueToken(user._id, "password_reset", ttl);
  try {
    await sendEmailNow("password_reset", user.email, {
      name: user.name,
      link: `${getAppUrl()}/reset-password?token=${encodeURIComponent(raw)}`,
      expiresInMinutes: ttl,
    });
  } catch (err) {
    deliveryFailed(err);
  }
  await audit({ action: "auth.password_reset_requested", actorRole: "anonymous", targetType: "user", targetId: String(user._id), ip });
  return { message: GENERIC_FORGOT_MESSAGE };
}

async function setNewPassword(userId: Types.ObjectId, password: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId },
    {
      $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0 },
      $inc: { sessionVersion: 1 },
      $unset: { lockUntil: 1 },
    },
    { returnDocument: "after" },
  ).lean();
  if (!user) throw badRequest("Account not found");
  await AuthToken.deleteMany({ userId, purpose: "password_reset", usedAt: { $exists: false } });
  const { id } = await enqueueEmail({
    idempotencyKey: `password_changed:${userId}:${user.sessionVersion}`,
    template: "password_changed",
    to: user.email,
    data: { name: user.name, at: new Date().toUTCString() },
  });
  dispatchSoon([id]);
  return user;
}

export async function resetPassword(rawToken: string, password: string, ip: string) {
  await enforce([[RULES.verifyIp, ip]]);
  const token = await consumeToken(rawToken, "password_reset");
  if (!token) throw badRequest("This reset link is invalid, has expired, or was already used.");
  const user = await setNewPassword(token.userId, password);
  await audit({ action: "auth.password_reset", actor: { id: String(user._id), role: user.role }, ip });
}

/** Requires the current password (reauthentication). Revokes all other sessions. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, ip: string) {
  await enforce([[RULES.passwordChange, userId]]);
  const user = await User.findById(userId).select("+passwordHash role").lean();
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    await audit({ action: "auth.password_change_failed", actor: user ? { id: userId, role: user.role } : null, ip });
    throw badRequest("Your current password is incorrect", { fields: { currentPassword: ["Incorrect password"] } });
  }
  const updated = await setNewPassword(user._id, newPassword);
  await audit({ action: "auth.password_changed", actor: { id: userId, role: updated.role }, ip });
  return signSession({ sub: userId, role: updated.role, sv: updated.sessionVersion });
}

export async function revokeAllSessions(userId: string) {
  await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
}
