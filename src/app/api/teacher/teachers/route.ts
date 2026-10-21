import { handler, json } from "@/lib/api";
import { TEAM_IDS, type Team } from "@/lib/team";
import { teacherProfileSchema } from "@/lib/validation";
import { createTeacherProfile, listTeacherProfiles } from "@/services/teacher-profile";

/** Public teacher, developer and video editor profiles (?team=…, default teacher), managed from the admin panel. */
export const GET = handler({ auth: "teacher" }, async ({ req }) => {
  const team = new URL(req.url).searchParams.get("team");
  return json({ teachers: await listTeacherProfiles(TEAM_IDS.includes(team as Team) ? (team as Team) : "teacher") });
});

export const POST = handler({ auth: "teacher", body: teacherProfileSchema, maxBodyBytes: 64 * 1024 }, async ({ body, user, ip }) => {
  return json({ teacher: await createTeacherProfile(user!, body, ip) }, { status: 201 });
});
