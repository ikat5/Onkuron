import { handler, json } from "@/lib/api";
import { lessonSchema } from "@/lib/validation";
import { createLesson, listLessonsForTeacher } from "@/services/lessons";

type P = { courseId: string };

export const GET = handler<undefined, P>({ auth: "teacher" }, async ({ params }) => {
  return json({ lessons: await listLessonsForTeacher(params.courseId) });
});

export const POST = handler<typeof lessonSchema, P>({ auth: "teacher", body: lessonSchema }, async ({ body, user, params, ip }) => {
  const lesson = await createLesson(user!, params.courseId, body, ip);
  return json({ id: lesson.id, lesson }, { status: 201 });
});
