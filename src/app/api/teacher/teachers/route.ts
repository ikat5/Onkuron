import { handler, json } from "@/lib/api";
import { teacherProfileSchema } from "@/lib/validation";
import { createTeacherProfile, listTeacherProfiles } from "@/services/teacher-profile";

/** Public teacher profiles, managed from the admin panel. */
export const GET = handler({ auth: "teacher" }, async () => json({ teachers: await listTeacherProfiles() }));

export const POST = handler({ auth: "teacher", body: teacherProfileSchema, maxBodyBytes: 64 * 1024 }, async ({ body, user, ip }) => {
  return json({ teacher: await createTeacherProfile(user!, body, ip) }, { status: 201 });
});
