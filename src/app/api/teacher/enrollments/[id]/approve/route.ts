import { handler, json } from "@/lib/api";
import { approveEnrollment } from "@/services/enrollment";

export const POST = handler<undefined, { id: string }>({ auth: "teacher" }, async ({ user, params, ip }) => {
  return json(await approveEnrollment(user!, params.id, ip));
});
