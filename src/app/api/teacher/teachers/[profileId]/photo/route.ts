import { handler, json } from "@/lib/api";
import { removeTeacherPhoto } from "@/services/teacher-profile";

type P = { profileId: string };

/** Uploading goes through /api/teacher/uploads (kind "teacher_photo" + profileId); this removes the photo. */
export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await removeTeacherPhoto(user!, params.profileId, ip);
  return json({ ok: true });
});
