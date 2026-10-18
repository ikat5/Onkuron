import { handler, json } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation";
import { changePassword } from "@/services/auth";

export const POST = handler({ auth: "any", body: changePasswordSchema }, async ({ body, user, ip }) => {
  const { token, maxAge } = await changePassword(user!.id, body.currentPassword, body.newPassword, ip);
  const res = json({ ok: true, message: "Password changed. Other devices have been signed out." });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
});
