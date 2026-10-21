import { handler, json } from "@/lib/api";
import { topicSchema } from "@/lib/validation";
import { createTopic, listTopics } from "@/services/interactive";

/** Interactive visual lessons (published and drafts), in homepage order. */
export const GET = handler({ auth: "teacher" }, async () => json({ topics: await listTopics() }));

export const POST = handler({ auth: "teacher", body: topicSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, ip }) => {
  return json({ topic: await createTopic(user!, body, ip) }, { status: 201 });
});
