import "server-only";
import { getTeacherEnv } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";
import { Setting } from "@/models/Setting";

const WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "changeme", "teacher", "teacher123", "admin", "admin123",
  "12345678", "123456789", "1234567890", "qwerty123", "letmein", "welcome1", "onkuron", "onkuron123",
]);

export class SeedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigError";
  }
}

export function assertStrongTeacherPassword(password: string) {
  const problems: string[] = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) problems.push("both letters and digits");
  if (WEAK_PASSWORDS.has(password.toLowerCase())) problems.push("not a common default password");
  if (problems.length) throw new SeedConfigError(`TEACHER_PASSWORD must contain ${problems.join(", ")}.`);
}

/** Shared credentials are high-value; recommend a long passphrase. */
export function teacherPasswordWarnings(password: string): string[] {
  return password.length < 12 ? ["TEACHER_PASSWORD is shorter than 12 characters; a longer passphrase is recommended for a shared account."] : [];
}

export type SeedResult =
  | { status: "created"; email: string }
  | { status: "exists"; email: string }
  | { status: "rotated"; email: string };

/**
 * Idempotent, concurrency-safe provisioning of the single shared teacher
 * account. Uses an atomic upsert with `$setOnInsert`, so running it repeatedly
 * (or from several instances at once) never resets the password and never
 * creates a second teacher; the unique `email` and `single_teacher` indexes
 * enforce this at the database level as well.
 */
export async function ensureTeacher(opts: { rotatePassword?: boolean } = {}): Promise<SeedResult> {
  let env;
  try {
    env = getTeacherEnv();
  } catch {
    throw new SeedConfigError("TEACHER_EMAIL and TEACHER_PASSWORD must both be set to seed the teacher account.");
  }
  const email = env.TEACHER_EMAIL.trim().toLowerCase();
  assertStrongTeacherPassword(env.TEACHER_PASSWORD);

  await User.init(); // make sure unique indexes exist before relying on them

  const otherTeacher = await User.findOne({ role: "teacher", email: { $ne: email } }).select("email").lean();
  if (otherTeacher) {
    throw new SeedConfigError(
      "A teacher account with a different email already exists. Update TEACHER_EMAIL or change the email of the existing account manually.",
    );
  }

  const existingStudent = await User.findOne({ email, role: { $ne: "teacher" } }).select("_id").lean();
  if (existingStudent) {
    throw new SeedConfigError("TEACHER_EMAIL is already registered as a student account. Use a different email.");
  }

  if (opts.rotatePassword) {
    const res = await User.updateOne(
      { email, role: "teacher" },
      {
        $set: { passwordHash: await hashPassword(env.TEACHER_PASSWORD), passwordChangedAt: new Date(), failedLoginCount: 0 },
        $inc: { sessionVersion: 1 },
        $unset: { lockUntil: 1 },
      },
    );
    if (res.matchedCount === 1) {
      await audit({ action: "teacher.password_rotated", actorRole: "system" });
      return { status: "rotated", email };
    }
  }

  const passwordHash = await hashPassword(env.TEACHER_PASSWORD);
  let res;
  try {
    res = await User.updateOne(
      { email, role: "teacher" },
      {
        $setOnInsert: {
          name: "Onkuron Teacher",
          email,
          role: "teacher",
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          sessionVersion: 0,
          failedLoginCount: 0,
        },
      },
      { upsert: true },
    );
  } catch (err) {
    // A concurrent seed won the race; the account now exists.
    if ((err as { code?: number }).code === 11000) return { status: "exists", email };
    throw err;
  }

  await ensurePlatformSettings();

  if (res.upsertedCount === 1) {
    await audit({ action: "teacher.seeded", actorRole: "system" });
    return { status: "created", email };
  }
  return { status: "exists", email };
}

/** Necessary system configuration: the platform settings document. */
export async function ensurePlatformSettings() {
  await Setting.updateOne(
    { key: "platform" },
    { $setOnInsert: { key: "platform", paymentNumbers: {}, paymentInstructions: "" } },
    { upsert: true },
  );
}
