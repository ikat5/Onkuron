import { handler, json } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { resetPassword } from "@/services/auth";

export const POST = handler({ auth: "none", body: resetPasswordSchema }, async ({ body, ip }) => {
  await resetPassword(body.token, body.password, ip);
  return json({ ok: true, message: "Your password has been reset. Please sign in." });
});
