import { handler, json } from "@/lib/api";
import { courseSchema } from "@/lib/validation";
import { createCourse } from "@/services/courses";

export const POST = handler({ auth: "teacher", body: courseSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, ip }) => {
  const course = await createCourse(user!, body, ip);
  return json({ id: String(course._id), slug: course.slug }, { status: 201 });
});
