import { handler, json } from "@/lib/api";
import { courseUpdateSchema } from "@/lib/validation";
import { deleteCourse, updateCourse } from "@/services/courses";

type P = { courseId: string };

export const PATCH = handler<typeof courseUpdateSchema, P>(
  { auth: "teacher", body: courseUpdateSchema, maxBodyBytes: 32 * 1024 },
  async ({ body, user, params, ip }) => {
    const course = await updateCourse(user!, params.courseId, body, ip);
    return json({ id: String(course._id), slug: course.slug });
  },
);

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await deleteCourse(user!, params.courseId, ip);
  return json({ ok: true });
});
