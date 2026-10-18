import { handler, json } from "@/lib/api";
import { resourceUpdateSchema } from "@/lib/validation";
import { updateResource } from "@/services/lessons";
import { removeLessonResource } from "@/services/uploads";

type P = { courseId: string; lessonId: string; resourceId: string };

export const PATCH = handler<typeof resourceUpdateSchema, P>({ auth: "teacher", body: resourceUpdateSchema }, async ({ body, user, params, ip }) => {
  return json({ lesson: await updateResource(user!, params.courseId, params.lessonId, params.resourceId, body, ip) });
});

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await removeLessonResource(user!, params.courseId, params.lessonId, params.resourceId, ip);
  return json({ ok: true });
});
