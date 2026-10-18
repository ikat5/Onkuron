import { handler, json } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/security/request";
import { loginSchema } from "@/lib/validation";
import { login } from "@/services/auth";

export const POST = handler({ auth: "none", body: loginSchema }, async ({ body, ip }) => {
  const { token, maxAge, user } = await login(body.email, body.password, ip);
  const fallback = user.role === "teacher" ? "/admin" : "/dashboard";
  let redirectTo = safeRedirectPath(body.next, fallback);
  // Students are never sent into the teacher area and vice versa.
  if (user.role === "student" && redirectTo.startsWith("/admin")) redirectTo = fallback;
  const res = json({ user: { name: user.name, role: user.role }, redirectTo });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
});
