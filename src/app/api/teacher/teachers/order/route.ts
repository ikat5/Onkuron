import { handler, json } from "@/lib/api";
import { teacherOrderSchema } from "@/lib/validation";
import { reorderTeacherProfiles } from "@/services/teacher-profile";

export const PUT = handler({ auth: "teacher", body: teacherOrderSchema, maxBodyBytes: 16 * 1024 }, async ({ body, user, ip }) => {
  return json({ teachers: await reorderTeacherProfiles(user!, body.profileIds, body.team, ip) });
});
