import { handler, json } from "@/lib/api";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { revokeAllSessions } from "@/services/auth";

export const POST = handler({ auth: "any" }, async ({ user, ip }) => {
  await revokeAllSessions(user!.id);
  await audit({ action: "auth.sessions_revoked", actor: user, ip });
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
});
