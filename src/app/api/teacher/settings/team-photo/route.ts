import { handler, json } from "@/lib/api";
import { removeTeamPhoto } from "@/services/settings";

/** Uploading goes through /api/teacher/uploads (kind "team_photo"); this removes the group photo. */
export const DELETE = handler({ auth: "teacher" }, async ({ user, ip }) => {
  await removeTeamPhoto(user!, ip);
  return json({ ok: true });
});
