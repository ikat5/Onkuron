import { afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { resetEnvCache } from "@/lib/env";
import { setMailTransport } from "@/lib/email/transport";
import { connectDB, disconnectDB } from "@/lib/db";
import { fakeMail } from "./fakes";

/** Deterministic, fake configuration — tests never read .env.local. */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  MONGODB_URI: process.env.TEST_MONGODB_URI!,
  MONGODB_DB_NAME: "onkuron_test",
  JWT_SECRET: "test-secret-test-secret-test-secret-0123456789",
  APP_URL: "http://localhost:3000",
  EMAIL_FROM: "Onkuron <no-reply@example.test>",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "user@example.test",
  SMTP_PASS: "smtp-pass-should-never-leak",
  CLOUDINARY_CLOUD_NAME: "demo-cloud",
  CLOUDINARY_API_KEY: "123456789012345",
  CLOUDINARY_API_SECRET: "cloudinary-secret-should-never-leak",
  TEACHER_EMAIL: "Teacher@Example.test",
  TEACHER_PASSWORD: "Correct-Horse-42",
  SEED_INITIAL_TEACHER: "false",
  JOB_DISPATCH: "manual",
  CRON_SECRET: "cron-secret-cron-secret-cron-secret-1234",
};

export function applyTestEnv(overrides: Record<string, string | undefined> = {}) {
  // Optional keys some tests set are cleared unless overridden, so they never leak between tests.
  for (const [k, v] of Object.entries({ RESEND_API_KEY: undefined, BREVO_API_KEY: undefined, ...TEST_ENV, ...overrides })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
}

applyTestEnv();

beforeEach(async () => {
  applyTestEnv();
  fakeMail.reset();
  setMailTransport(fakeMail);
  await connectDB();
  const db = mongoose.connection.db!;
  for (const c of await db.collections()) await c.deleteMany({});
});

afterAll(async () => {
  await disconnectDB();
});
