import { handler, json } from "@/lib/api";
import { lessonUpdateSchema } from "@/lib/validation";
import { deleteLesson, getLessonForTeacher, updateLesson } from "@/services/lessons";

type P = { courseId: string; lessonId: string };

export const GET = handler<undefined, P>({ auth: "teacher" }, async ({ params }) => {
  return json({ lesson: await getLessonForTeacher(params.courseId, params.lessonId) });
});

export const PATCH = handler<typeof lessonUpdateSchema, P>(
  { auth: "teacher", body: lessonUpdateSchema },
  async ({ body, user, params, ip }) => {
    return json({ ok: true, lesson: await updateLesson(user!, params.courseId, params.lessonId, body, ip) });
  },
);

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await deleteLesson(user!, params.courseId, params.lessonId, ip);
  return json({ ok: true });
});
