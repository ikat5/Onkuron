import { handler, json } from "@/lib/api";
import { resendSchema } from "@/lib/validation";
import { resendVerification } from "@/services/auth";

export const POST = handler({ auth: "none", body: resendSchema }, async ({ body, ip }) => {
  return json(await resendVerification(body.email, ip), { status: 202 });
});
