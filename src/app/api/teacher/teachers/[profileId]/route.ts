import { handler, json } from "@/lib/api";
import { teacherProfileSchema } from "@/lib/validation";
import { deleteTeacherProfile, getTeacherProfile, updateTeacherProfile } from "@/services/teacher-profile";

type P = { profileId: string };

export const GET = handler<undefined, P>({ auth: "teacher" }, async ({ params }) => json({ teacher: await getTeacherProfile(params.profileId) }));

export const PUT = handler<typeof teacherProfileSchema, P>({ auth: "teacher", body: teacherProfileSchema, maxBodyBytes: 64 * 1024 }, async ({ body, user, params, ip }) => {
  return json({ teacher: await updateTeacherProfile(user!, params.profileId, body, ip) });
});

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await deleteTeacherProfile(user!, params.profileId, ip);
  return json({ ok: true });
});
