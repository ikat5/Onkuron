import { handler, json } from "@/lib/api";
import { progressSchema } from "@/lib/validation";
import { recordProgress } from "@/services/progress";

type P = { lessonId: string };

/** Playback heartbeat and explicit completion toggle for the signed-in student. */
export const POST = handler<typeof progressSchema, P>({ auth: "student", body: progressSchema, maxBodyBytes: 2 * 1024 }, async ({ user, params, body }) => {
  return json({ progress: await recordProgress(user!, params.lessonId, body) });
});
