import { handler, json } from "@/lib/api";
import { messageSchema } from "@/lib/validation";
import { listMessages, sendMessage } from "@/services/chat";

type P = { conversationId: string };

export const GET = handler<undefined, P>({ auth: "any" }, async ({ user, params, req }) => {
  const after = req.nextUrl.searchParams.get("after") ?? undefined;
  return json({ messages: await listMessages(user!, params.conversationId, after) });
});

export const POST = handler<typeof messageSchema, P>({ auth: "any", body: messageSchema, maxBodyBytes: 8 * 1024 }, async ({ user, params, body }) => {
  return json({ message: await sendMessage(user!, params.conversationId, body.body, body.context) }, { status: 201 });
});
