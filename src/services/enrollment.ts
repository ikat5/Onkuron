import "server-only";
import mongoose, { Types } from "mongoose";
import { conflict, notFound, tooManyRequests } from "@/lib/errors";
import { hit, RULES } from "@/lib/security/rate-limit";
import { dispatchSoon, enqueueEmail } from "@/lib/email/outbox";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import type { EnrollmentInput } from "@/lib/validation";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";

export async function hasApprovedEnrollment(studentId: string, courseId: Types.ObjectId | string) {
  if (!Types.ObjectId.isValid(studentId)) return false;
  return Boolean(
    await Enrollment.exists({ studentId: new Types.ObjectId(studentId), courseId, status: "approved" }),
  );
}

/**
 * Creates a pending enrollment. The amount comes from the course document,
 * never from the client; payment remains unverified until a teacher decides.
 */
export async function submitEnrollment(student: SessionUser, input: EnrollmentInput, ip: string) {
  const rl = await hit(RULES.enrollUser, student.id);
  if (!rl.allowed) throw tooManyRequests(rl.retryAfterSeconds);

  const course = await Course.findOne({ _id: input.courseId, published: true }).select("title price slug").lean();
  if (!course) throw notFound("Course not found");

  const studentId = new Types.ObjectId(student.id);
  const existing = await Enrollment.findOne({ studentId, courseId: course._id, active: true }).select("status").lean();
  if (existing) {
    throw conflict(
      existing.status === "approved"
        ? "You are already enrolled in this course."
        : "You already have a pending enrollment request for this course.",
    );
  }

  let enrollmentId: Types.ObjectId;
  let outboxId: Types.ObjectId | null = null;
  try {
    await mongoose.connection.transaction(async (session) => {
      const [enrollment] = await Enrollment.create(
        [
          {
            studentId,
            courseId: course._id,
            status: "pending",
            active: true,
            amount: course.price,
            paymentMethod: input.paymentMethod,
            transactionId: input.transactionId,
            senderNumber: input.senderNumber,
          },
        ],
        { session },
      );
      enrollmentId = enrollment._id;
      outboxId = (
        await enqueueEmail(
          {
            idempotencyKey: `enrollment:${enrollment._id}:submitted`,
            template: "enrollment_submitted",
            to: student.email,
            data: {
              name: student.name,
              courseTitle: course.title,
              amount: course.price,
              paymentMethod: input.paymentMethod,
              transactionId: input.transactionId,
            },
          },
          session,
        )
      ).id;
      await audit(
        {
          action: "enrollment.submitted",
          actor: student,
          targetType: "enrollment",
          targetId: String(enrollment._id),
          ip,
          metadata: { courseId: String(course._id), amount: course.price, paymentMethod: input.paymentMethod },
        },
        session,
      );
    });
  } catch (err) {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e.code === 11000) {
      if (e.keyPattern && "transactionId" in e.keyPattern) {
        throw conflict("This transaction ID has already been submitted. Check it and try again.");
      }
      throw conflict("You already have a pending or approved enrollment for this course.");
    }
    throw err;
  }
  dispatchSoon([outboxId]);
  return { id: String(enrollmentId!), status: "pending" as const, amount: course.price };
}

type Decision = { kind: "approved" } | { kind: "rejected"; reason: string };

/**
 * Idempotent teacher decision. The state transition is a conditional update
 * (`status: "pending"`) inside a transaction together with the audit entry
 * and the outbox record, so the email job exists iff the decision committed.
 * SMTP is contacted only afterwards — an outage never rolls back a decision.
 * Repeating a decision returns the existing result without a second email.
 */
async function decide(teacher: SessionUser, enrollmentId: string, decision: Decision, ip: string) {
  if (!Types.ObjectId.isValid(enrollmentId)) throw notFound("Enrollment not found");
  let outboxId: Types.ObjectId | null = null;
  let alreadyDecided = false;

  await mongoose.connection.transaction(async (session) => {
    outboxId = null;
    alreadyDecided = false;
    const now = new Date();
    const updated = await Enrollment.findOneAndUpdate(
      { _id: enrollmentId, status: "pending" },
      {
        $set: {
          status: decision.kind,
          decidedAt: now,
          active: decision.kind === "approved",
          ...(decision.kind === "rejected" ? { decisionReason: decision.reason } : {}),
        },
      },
      { returnDocument: "after", session },
    ).lean();

    if (!updated) {
      const current = await Enrollment.findById(enrollmentId).select("status").session(session).lean();
      if (!current) throw notFound("Enrollment not found");
      if (current.status === decision.kind) {
        alreadyDecided = true;
        return;
      }
      throw conflict(`This enrollment was already ${current.status}.`);
    }

    const [student, course] = await Promise.all([
      User.findById(updated.studentId).select("name email").session(session).lean(),
      Course.findById(updated.courseId).select("title slug").session(session).lean(),
    ]);
    if (student && course) {
      outboxId = (
        await enqueueEmail(
          {
            idempotencyKey: `enrollment:${updated._id}:${decision.kind}`,
            template: decision.kind === "approved" ? "enrollment_approved" : "enrollment_rejected",
            to: student.email,
            data:
              decision.kind === "approved"
                ? { name: student.name, courseTitle: course.title, courseSlug: course.slug }
                : { name: student.name, courseTitle: course.title, courseSlug: course.slug, reason: decision.reason },
          },
          session,
        )
      ).id;
    }
    await audit(
      {
        action: `enrollment.${decision.kind}`,
        actor: teacher,
        targetType: "enrollment",
        targetId: enrollmentId,
        ip,
        metadata: {
          sharedTeacherAccount: true,
          transactionId: updated.transactionId,
          ...(decision.kind === "rejected" ? { reason: decision.reason } : {}),
        },
      },
      session,
    );
  });

  dispatchSoon([outboxId]);
  return { status: decision.kind, alreadyDecided };
}

export const approveEnrollment = (teacher: SessionUser, id: string, ip: string) =>
  decide(teacher, id, { kind: "approved" }, ip);

export const rejectEnrollment = (teacher: SessionUser, id: string, reason: string, ip: string) =>
  decide(teacher, id, { kind: "rejected", reason }, ip);
