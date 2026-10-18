import { describe, expect, it } from "vitest";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as verify from "@/app/api/auth/verify-email/route";
import * as resend from "@/app/api/auth/resend-verification/route";
import * as enroll from "@/app/api/enrollments/route";
import * as messages from "@/app/api/chat/[conversationId]/messages/route";
import { getSessionUserFromToken } from "@/lib/auth/current";
import { hashToken } from "@/lib/auth/tokens";
import { signSession } from "@/lib/auth/session";
import { AuthToken } from "@/models/AuthToken";
import { AuditLog } from "@/models/AuditLog";
import { EmailOutbox } from "@/models/EmailOutbox";
import { User } from "@/models/User";
import { processDueOutbox } from "@/lib/email/outbox";
import { extractLink, fakeMail } from "./helpers/fakes";
import { call, createUser } from "./helpers/http";
import { applyTestEnv } from "./helpers/setup";

const student = {
  name: "Rahim Uddin",
  email: "Rahim@Example.test",
  phone: "01712345678",
  password: "Password123",
  confirmPassword: "Password123",
};

async function registerAndGetToken(ip = "10.0.0.1") {
  const res = await call(register.POST, { body: student, headers: { "x-forwarded-for": ip } });
  expect(res.status).toBe(202);
  const mail = fakeMail.to("rahim@example.test").at(-1)!;
  return { res, mail, token: extractLink(mail, "/verify-email") };
}

describe("student registration and email verification", () => {
  it("creates an unverified account and emails a verification link (hash stored only)", async () => {
    const { mail, token } = await registerAndGetToken();
    const user = await User.findOne({ email: "rahim@example.test" }).select("+passwordHash").lean();
    expect(user).toBeTruthy();
    expect(user!.emailVerified).toBe(false);
    expect(user!.passwordHash).not.toContain("Password123");
    expect(mail.subject).toMatch(/Verify/);
    expect(mail.html).toContain("Rahim Uddin");
    expect(token.length).toBeGreaterThanOrEqual(40);

    const stored = await AuthToken.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    // The raw token is never written to the outbox or audit log.
    expect(JSON.stringify(await EmailOutbox.find({}).lean())).not.toContain(token);
    expect(JSON.stringify(await AuditLog.find({}).lean())).not.toContain(token);
  });

  it("verifies the account through a valid link, then allows login", async () => {
    const { token } = await registerAndGetToken();
    const v = await call(verify.POST, { body: { token } });
    expect(v.status).toBe(200);
    const user = await User.findOne({ email: "rahim@example.test" }).lean();
    expect(user!.emailVerified).toBe(true);

    // Success notification goes through the outbox.
    await processDueOutbox();
    expect(fakeMail.to("rahim@example.test").some((m) => /ready/.test(m.subject))).toBe(true);

    const l = await call(login.POST, { body: { email: "rahim@example.test", password: "Password123" } });
    expect(l.status).toBe(200);
    const cookie = l.headers.get("set-cookie")!;
    expect(cookie).toMatch(/onkuron_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(l.json.redirectTo).toBe("/dashboard");
  });

  it("rejects reused, invalid and expired tokens", async () => {
    const { token } = await registerAndGetToken();
    expect((await call(verify.POST, { body: { token } })).status).toBe(200);
    expect((await call(verify.POST, { body: { token } })).status).toBe(400); // reuse

    expect((await call(verify.POST, { body: { token: "x".repeat(43) } })).status).toBe(400);
    expect((await call(verify.POST, { body: { token: { $ne: null } } })).status).toBe(400); // injection attempt

    await User.updateOne({ email: "rahim@example.test" }, { $set: { emailVerified: false } });
    const second = await registerAndGetTokenAfterCooldown();
    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(verify.POST, { body: { token: second } })).status).toBe(400);
  });

  it("consumes a token atomically under concurrent requests", async () => {
    const { token } = await registerAndGetToken();
    const results = await Promise.all(Array.from({ length: 5 }, () => call(verify.POST, { body: { token } })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("rejects login before verification without issuing a session", async () => {
    await registerAndGetToken();
    const res = await call(login.POST, { body: { email: "rahim@example.test", password: "Password123" } });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("email_unverified");
    expect(res.headers.get("set-cookie")).toBeNull();

    // Even a validly signed token for an unverified account is not accepted.
    const user = await User.findOne({ email: "rahim@example.test" }).lean();
    const { token } = await signSession({ sub: String(user!._id), role: "student", sv: 0 });
    expect(await getSessionUserFromToken(token)).toBeNull();
  });

  it("gives a generic login error for unknown accounts and wrong passwords", async () => {
    await createUser({ email: "known@example.test", password: "Password123" });
    const a = await call(login.POST, { body: { email: "known@example.test", password: "Wrong12345" } });
    const b = await call(login.POST, { body: { email: "nobody@example.test", password: "Wrong12345" } });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error.message).toBe(b.json.error.message);
  });

  it("does not let unverified accounts enroll or chat", async () => {
    const { cookie } = await createUser({ verified: false });
    // Unverified users never hold a valid session, so protected routes reject them.
    const e = await call(enroll.POST, { cookie, body: { courseId: "a".repeat(24), paymentMethod: "bkash", transactionId: "ABC12345", senderNumber: "01712345678" } });
    expect(e.status).toBe(401);
    const m = await call(messages.POST, { cookie, body: { body: "hi" }, params: { conversationId: "a".repeat(24) } });
    expect(m.status).toBe(401);
  });

  it("does not reveal whether an email is already registered", async () => {
    await createUser({ email: "taken@example.test", name: "Existing Person" });
    const fresh = await call(register.POST, { body: { ...student, email: "new@example.test" } });
    const taken = await call(register.POST, { body: { ...student, email: "taken@example.test" } });
    expect(taken.status).toBe(fresh.status);
    expect(taken.json).toEqual(fresh.json);
    // The real owner is notified instead.
    await processDueOutbox();
    expect(fakeMail.to("taken@example.test")[0].subject).toMatch(/registration attempt/i);
  });

  it("rate-limits registrations per IP", async () => {
    applyTestEnv({ TRUST_PROXY: "true" });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await call(register.POST, { body: { ...student, email: `r${i}@example.test` }, headers: { "x-forwarded-for": "203.0.113.9" } });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 202)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("applies a cooldown and hourly limit to resends and invalidates older links", async () => {
    const { token: first } = await registerAndGetToken();
    // Immediately after registration the cooldown is active.
    expect((await call(resend.POST, { body: { email: "rahim@example.test" } })).status).toBe(429);

    await expireCooldowns();
    const r = await call(resend.POST, { body: { email: "rahim@example.test" } });
    expect(r.status).toBe(202);
    const second = extractLink(fakeMail.to("rahim@example.test").at(-1)!, "/verify-email");
    expect(second).not.toBe(first);
    expect((await call(verify.POST, { body: { token: first } })).status).toBe(400); // old link invalidated

    for (let i = 0; i < 2; i++) {
      await expireCooldowns();
      await call(resend.POST, { body: { email: "rahim@example.test" } });
    }
    await expireCooldowns();
    expect((await call(resend.POST, { body: { email: "rahim@example.test" } })).status).toBe(429); // 4th in the hour
  });

  it("returns the same resend response for unknown emails", async () => {
    const r = await call(resend.POST, { body: { email: "ghost@example.test" } });
    expect(r.status).toBe(202);
    expect(fakeMail.sent).toHaveLength(0);
  });

  it("does not claim an email was sent when SMTP is missing or failing", async () => {
    applyTestEnv({ SMTP_HOST: undefined });
    const missing = await call(register.POST, { body: student });
    expect(missing.status).toBe(503);
    expect(missing.text).not.toMatch(/inbox/i);
    expect(await User.countDocuments({})).toBe(0);

    applyTestEnv();
    fakeMail.failNext(1);
    const failing = await call(register.POST, { body: student });
    expect(failing.status).toBe(502);
    expect(failing.json.error.code).toBe("email_failed");
    expect(failing.text).not.toContain("ETIMEDOUT");
  });
});

async function expireCooldowns() {
  const { RateLimit } = await import("@/models/RateLimit");
  await RateLimit.deleteMany({ key: /^resend:cooldown/ });
}

async function registerAndGetTokenAfterCooldown() {
  await expireCooldowns();
  await call(resend.POST, { body: { email: "rahim@example.test" } });
  return extractLink(fakeMail.to("rahim@example.test").at(-1)!, "/verify-email");
}
