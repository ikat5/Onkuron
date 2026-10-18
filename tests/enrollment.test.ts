import { describe, expect, it } from "vitest";
import * as enroll from "@/app/api/enrollments/route";
import * as approve from "@/app/api/teacher/enrollments/[id]/approve/route";
import * as reject from "@/app/api/teacher/enrollments/[id]/reject/route";
import * as retry from "@/app/api/teacher/emails/[id]/retry/route";
import { processDueOutbox } from "@/lib/email/outbox";
import { Course } from "@/models/Course";
import { EmailOutbox } from "@/models/EmailOutbox";
import { Enrollment } from "@/models/Enrollment";
import { AuditLog } from "@/models/AuditLog";
import { fakeMail } from "./helpers/fakes";
import { call, createUser } from "./helpers/http";
import { applyTestEnv } from "./helpers/setup";

async function setup() {
  const course = await Course.create({ title: "HSC Physics", slug: "hsc-physics", price: 1500, published: true });
  const s = await createUser({ email: "student@example.test", name: "Karim" });
  const t = await createUser({ role: "teacher", email: "teacher@example.test", name: "Teacher" });
  return { course, s, t };
}

const payment = { paymentMethod: "bkash", transactionId: "9a7b6c5d4e", senderNumber: "01812345678" };

async function submit(courseId: string, cookie: string, extra: Record<string, unknown> = {}) {
  return call(enroll.POST, { cookie, body: { courseId, ...payment, ...extra } });
}

describe("enrollment submission", () => {
  it("creates a pending enrollment with the server-side price and queues a pending email", async () => {
    const { course, s } = await setup();
    // Client-supplied amount/status/studentId are ignored (schema strips unknown keys).
    const res = await submit(String(course._id), s.cookie, { amount: 1, status: "approved", studentId: "x" });
    expect(res.status).toBe(201);
    const e = await Enrollment.findOne({}).lean();
    expect(e!.status).toBe("pending");
    expect(e!.amount).toBe(1500);
    expect(e!.transactionId).toBe("9A7B6C5D4E");
    expect(String(e!.studentId)).toBe(String(s.user._id));

    await processDueOutbox();
    const mail = fakeMail.to("student@example.test")[0];
    expect(mail.subject).toMatch(/Enrollment request received/);
    expect(mail.text).toMatch(/not yet been verified/);
    expect(mail.text).not.toMatch(/payment (has been|was) verified/i);
    expect(mail.text).toContain("HSC Physics");
  });

  it("blocks duplicate requests and reused transaction IDs", async () => {
    const { course, s } = await setup();
    expect((await submit(String(course._id), s.cookie)).status).toBe(201);
    expect((await submit(String(course._id), s.cookie)).status).toBe(409);
    const other = await createUser({ email: "other@example.test" });
    const dup = await submit(String(course._id), other.cookie);
    expect(dup.status).toBe(409);
    expect(dup.json.error.message).toMatch(/transaction ID/);
  });

  it("rejects malformed payment data and unpublished courses", async () => {
    const { course, s } = await setup();
    expect((await submit(String(course._id), s.cookie, { paymentMethod: "paypal" })).status).toBe(400);
    expect((await submit(String(course._id), s.cookie, { transactionId: "<script>" })).status).toBe(400);
    await Course.updateOne({ _id: course._id }, { published: false });
    expect((await submit(String(course._id), s.cookie)).status).toBe(404);
  });
});

describe("teacher decisions and notification emails", () => {
  async function pending() {
    const ctx = await setup();
    await submit(String(ctx.course._id), ctx.s.cookie);
    await processDueOutbox(); // deliver the submission email
    fakeMail.reset();
    const e = await Enrollment.findOne({}).lean();
    return { ...ctx, id: String(e!._id) };
  }

  it("approves, records an audit entry, and emails a confirmation with a course link", async () => {
    const { id, t } = await pending();
    const res = await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} });
    expect(res.status).toBe(200);
    expect((await Enrollment.findById(id).lean())!.status).toBe("approved");
    expect(await AuditLog.countDocuments({ action: "enrollment.approved" })).toBe(1);

    await processDueOutbox();
    const mail = fakeMail.to("student@example.test")[0];
    expect(mail.subject).toBe("Enrollment confirmed — HSC Physics");
    expect(mail.html).toContain("Karim");
    expect(mail.html).toContain("http://localhost:3000/learn/hsc-physics");
    expect(mail.text).toMatch(/access has been granted/);
  });

  it("is idempotent: approving twice sends only one email", async () => {
    const { id, t } = await pending();
    const [a, b] = await Promise.all([
      call(approve.POST, { cookie: t.cookie, params: { id }, body: {} }),
      call(approve.POST, { cookie: t.cookie, params: { id }, body: {} }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const third = await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} });
    expect(third.json.alreadyDecided).toBe(true);
    await processDueOutbox();
    expect(await EmailOutbox.countDocuments({ template: "enrollment_approved" })).toBe(1);
    expect(fakeMail.to("student@example.test")).toHaveLength(1);
  });

  it("rejects with a reason and emails the student", async () => {
    const { id, t } = await pending();
    expect((await call(reject.POST, { cookie: t.cookie, params: { id }, body: { reason: "" } })).status).toBe(400);
    const res = await call(reject.POST, { cookie: t.cookie, params: { id }, body: { reason: "Transaction not found" } });
    expect(res.status).toBe(200);
    const e = await Enrollment.findById(id).lean();
    expect(e!.status).toBe("rejected");
    expect(e!.active).toBe(false);
    // An approved decision can't follow a rejection.
    expect((await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} })).status).toBe(409);
    await processDueOutbox();
    const mail = fakeMail.to("student@example.test")[0];
    expect(mail.subject).toMatch(/not approved/);
    expect(mail.text).toContain("Transaction not found");
  });

  it("does not let a student approve enrollments", async () => {
    const { id, s } = await pending();
    const res = await call(approve.POST, { cookie: s.cookie, params: { id }, body: {} });
    expect(res.status).toBe(403);
    expect((await Enrollment.findById(id).lean())!.status).toBe("pending");
    expect((await call(approve.POST, { params: { id }, body: {} })).status).toBe(401);
  });

  it("keeps the approval when SMTP is down and retries with backoff until delivered", async () => {
    const { id, t } = await pending();
    fakeMail.failNext(1);
    expect((await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} })).status).toBe(200);
    const r1 = await processDueOutbox();
    expect(r1.failed).toBe(1);
    expect((await Enrollment.findById(id).lean())!.status).toBe("approved");

    let msg = await EmailOutbox.findOne({ template: "enrollment_approved" }).lean();
    expect(msg!.status).toBe("failed");
    expect(msg!.attempts).toBe(1);
    expect(msg!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    expect(msg!.lastError).toMatch(/ETIMEDOUT/);
    expect(msg!.lastError).not.toContain("smtp-pass-should-never-leak");

    // Not due yet: nothing happens.
    expect((await processDueOutbox()).sent).toBe(0);
    // Simulate the backoff elapsing.
    await EmailOutbox.updateOne({ _id: msg!._id }, { $set: { nextAttemptAt: new Date() } });
    expect((await processDueOutbox()).sent).toBe(1);
    msg = await EmailOutbox.findById(msg!._id).lean();
    expect(msg!.status).toBe("sent");
    expect(msg!.history.map((h) => h.ok)).toEqual([false, true]);
  });

  it("marks permanently failing messages dead and lets the teacher retry them", async () => {
    const { id, t, s } = await pending();
    fakeMail.failNext(1, true);
    await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} });
    expect((await processDueOutbox()).dead).toBe(1);
    const msg = await EmailOutbox.findOne({ template: "enrollment_approved" }).lean();
    expect(msg!.status).toBe("dead");

    expect((await call(retry.POST, { cookie: s.cookie, params: { id: String(msg!._id) }, body: {} })).status).toBe(403);
    const r = await call(retry.POST, { cookie: t.cookie, params: { id: String(msg!._id) }, body: {} });
    expect(r.status).toBe(200);
    expect(r.json.result).toBe("sent");
    expect(fakeMail.to("student@example.test")).toHaveLength(1);
  });

  it("waits (without burning attempts) while SMTP is not configured", async () => {
    const { id, t } = await pending();
    applyTestEnv({ SMTP_HOST: undefined });
    await call(approve.POST, { cookie: t.cookie, params: { id }, body: {} });
    await processDueOutbox();
    const msg = await EmailOutbox.findOne({ template: "enrollment_approved" }).lean();
    expect(msg!.status).toBe("failed");
    expect(msg!.attempts).toBe(0);
    expect(msg!.lastError).toBe("SMTP is not configured");
    expect(fakeMail.sent).toHaveLength(0);
  });
});
