/**
 * Idempotently provisions the shared teacher account from TEACHER_EMAIL and
 * TEACHER_PASSWORD. Never resets an existing password unless
 * `--rotate-password` is passed explicitly.
 *
 *   npm run seed:teacher
 *   npm run seed:teacher -- --rotate-password
 */
import { connectDB, disconnectDB } from "@/lib/db";
import { ensureTeacher, SeedConfigError, teacherPasswordWarnings } from "@/services/teacher-seed";

async function main() {
  const rotate = process.argv.includes("--rotate-password");
  try {
    await connectDB();
    const result = await ensureTeacher({ rotatePassword: rotate });
    const msg = {
      created: "Created the shared teacher account",
      exists: "Teacher account already exists — left unchanged",
      rotated: "Teacher password rotated; all existing teacher sessions were signed out",
    }[result.status];
    console.log(`✔ ${msg} (${result.email}).`);
    for (const w of teacherPasswordWarnings(process.env.TEACHER_PASSWORD ?? "")) console.warn(`! ${w}`);
  } catch (err) {
    console.error(`✘ ${err instanceof SeedConfigError ? err.message : (err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
