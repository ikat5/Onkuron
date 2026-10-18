import { handler, json } from "@/lib/api";
import { linkResourceSchema } from "@/lib/validation";
import { addLinkResource } from "@/services/lessons";

type P = { courseId: string; lessonId: string };

/** Adds an external link resource. Files are added through the signed upload flow (/api/teacher/uploads). */
export const POST = handler<typeof linkResourceSchema, P>({ auth: "teacher", body: linkResourceSchema }, async ({ body, user, params, ip }) => {
  return json({ lesson: await addLinkResource(user!, params.courseId, params.lessonId, body, ip) }, { status: 201 });
});
