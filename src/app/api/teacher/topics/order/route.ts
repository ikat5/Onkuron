import { handler, json } from "@/lib/api";
import { idOrderSchema } from "@/lib/validation";
import { reorderTopics } from "@/services/interactive";

export const PUT = handler({ auth: "teacher", body: idOrderSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, ip }) => {
  return json({ topics: await reorderTopics(user!, body.ids, ip) });
});
