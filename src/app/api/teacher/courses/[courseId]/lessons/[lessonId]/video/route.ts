import { handler, json } from "@/lib/api";
import { removeLessonVideo } from "@/services/uploads";

type P = { courseId: string; lessonId: string };

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await removeLessonVideo(user!, params.courseId, params.lessonId, ip);
  return json({ ok: true });
});
