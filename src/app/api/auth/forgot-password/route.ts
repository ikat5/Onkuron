import { handler, json } from "@/lib/api";
import { forgotSchema } from "@/lib/validation";
import { forgotPassword } from "@/services/auth";

export const POST = handler({ auth: "none", body: forgotSchema }, async ({ body, ip }) => {
  return json(await forgotPassword(body.email, ip), { status: 202 });
});
