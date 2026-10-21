import { handler, json } from "@/lib/api";
import { topicSchema } from "@/lib/validation";
import { deleteTopic, getTopic, updateTopic } from "@/services/interactive";

type P = { topicId: string };

export const GET = handler<undefined, P>({ auth: "teacher" }, async ({ params }) => json({ topic: await getTopic(params.topicId) }));

export const PUT = handler<typeof topicSchema, P>({ auth: "teacher", body: topicSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, params, ip }) => {
  return json({ topic: await updateTopic(user!, params.topicId, body, ip) });
});

export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await deleteTopic(user!, params.topicId, ip);
  return json({ ok: true });
});
