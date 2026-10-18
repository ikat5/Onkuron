import { handler, json } from "@/lib/api";
import { lessonOrderSchema } from "@/lib/validation";
import { reorderLessons } from "@/services/lessons";

type P = { courseId: string };

export const PUT = handler<typeof lessonOrderSchema, P>({ auth: "teacher", body: lessonOrderSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, params, ip }) => {
  return json({ lessons: await reorderLessons(user!, params.courseId, body.lessonIds, ip) });
});
