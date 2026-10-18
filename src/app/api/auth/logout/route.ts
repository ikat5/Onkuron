import { handler, json } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const POST = handler({ auth: "none" }, async () => {
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
});
