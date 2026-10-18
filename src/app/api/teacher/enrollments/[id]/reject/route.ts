import { handler, json } from "@/lib/api";
import { rejectSchema } from "@/lib/validation";
import { rejectEnrollment } from "@/services/enrollment";

export const POST = handler<typeof rejectSchema, { id: string }>({ auth: "teacher", body: rejectSchema }, async ({ user, params, body, ip }) => {
  return json(await rejectEnrollment(user!, params.id, body.reason, ip));
});
