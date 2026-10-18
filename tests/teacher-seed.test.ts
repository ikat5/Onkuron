import { describe, expect, it } from "vitest";
import { ensureTeacher, SeedConfigError } from "@/services/teacher-seed";
import { verifyPassword } from "@/lib/auth/password";
import { User } from "@/models/User";
import { Setting } from "@/models/Setting";
import { applyTestEnv } from "./helpers/setup";
import { createUser } from "./helpers/http";

describe("shared teacher seeding", () => {
  it("creates the teacher with a normalized email and a scrypt hash", async () => {
    const r = await ensureTeacher();
    expect(r).toEqual({ status: "created", email: "teacher@example.test" });
    const t = await User.findOne({ role: "teacher" }).select("+passwordHash").lean();
    expect(t!.email).toBe("teacher@example.test");
    expect(t!.emailVerified).toBe(true);
    expect(t!.passwordHash).toMatch(/^scrypt\$/);
    expect(t!.passwordHash).not.toContain("Correct-Horse-42");
    expect(await verifyPassword("Correct-Horse-42", t!.passwordHash)).toBe(true);
    expect(await Setting.countDocuments({ key: "platform" })).toBe(1);
  });

  it("is idempotent and never resets an existing password", async () => {
    await ensureTeacher();
    const first = await User.findOne({ role: "teacher" }).select("+passwordHash").lean();
    applyTestEnv({ TEACHER_PASSWORD: "Another-Strong-99" });
    expect((await ensureTeacher()).status).toBe("exists");
    const second = await User.findOne({ role: "teacher" }).select("+passwordHash").lean();
    expect(second!.passwordHash).toBe(first!.passwordHash);
    expect(await User.countDocuments({ role: "teacher" })).toBe(1);
  });

  it("does not create duplicates when many seeds run concurrently", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => ensureTeacher()));
    expect(results.filter((r) => r.status === "created")).toHaveLength(1);
    expect(await User.countDocuments({ role: "teacher" })).toBe(1);
  });

  it("refuses a second teacher with a different email (single_teacher index)", async () => {
    await ensureTeacher();
    applyTestEnv({ TEACHER_EMAIL: "other@example.test" });
    await expect(ensureTeacher()).rejects.toBeInstanceOf(SeedConfigError);
    await expect(
      User.create({ name: "x", email: "x@example.test", passwordHash: "x", role: "teacher" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rotates the password only when explicitly requested and revokes sessions", async () => {
    await ensureTeacher();
    applyTestEnv({ TEACHER_PASSWORD: "Rotated-Pass-77" });
    expect((await ensureTeacher({ rotatePassword: true })).status).toBe("rotated");
    const t = await User.findOne({ role: "teacher" }).select("+passwordHash").lean();
    expect(await verifyPassword("Rotated-Pass-77", t!.passwordHash)).toBe(true);
    expect(t!.sessionVersion).toBe(1);
  });

  it("requires complete and strong configuration", async () => {
    applyTestEnv({ TEACHER_PASSWORD: undefined });
    await expect(ensureTeacher()).rejects.toThrow(/TEACHER_EMAIL and TEACHER_PASSWORD/);
    applyTestEnv({ TEACHER_PASSWORD: "password123" });
    await expect(ensureTeacher()).rejects.toThrow(/common default/);
    applyTestEnv({ TEACHER_PASSWORD: "abc" });
    await expect(ensureTeacher()).rejects.toThrow(/8 characters/);
    expect(await User.countDocuments({ role: "teacher" })).toBe(0);
  });

  it("refuses to turn an existing student into the teacher", async () => {
    await createUser({ email: "teacher@example.test" });
    await expect(ensureTeacher()).rejects.toThrow(/student account/);
  });
});
