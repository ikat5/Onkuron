import { handler, json } from "@/lib/api";
import { getOrCreateStudentConversation } from "@/services/chat";

export const POST = handler({ auth: "student" }, async ({ user }) => {
  const conv = await getOrCreateStudentConversation(user!);
  return json({ id: String(conv._id) });
});
