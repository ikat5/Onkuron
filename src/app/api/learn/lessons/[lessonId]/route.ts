import { handler, json } from "@/lib/api";
import { getLessonForLearner } from "@/services/learning";

type P = { lessonId: string };

/** Protected lesson details (description, video ID, resources) — approved enrollment required. */
export const GET = handler<undefined, P>({ auth: "any" }, async ({ user, params }) => {
  return json(await getLessonForLearner(user!, params.lessonId));
});
