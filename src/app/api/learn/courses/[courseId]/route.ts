import { handler, json } from "@/lib/api";
import { getCourseForLearner } from "@/services/learning";

type P = { courseId: string };

/** Course curriculum with lesson details and the caller's progress — approved enrollment required. */
export const GET = handler<undefined, P>({ auth: "any" }, async ({ user, params }) => {
  return json(await getCourseForLearner(user!, { courseId: params.courseId }));
});
