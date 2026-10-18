import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { User, type Role } from "@/models/User";

/** Request-scoped view of the signed-in user. Never stored in a shared singleton. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

/**
 * Validates the JWT *and* the database record: the account must still exist,
 * keep the same role, and have a matching sessionVersion (revocation).
 */
export async function getSessionUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  const claims = await verifySession(token);
  if (!claims || !Types.ObjectId.isValid(claims.sub)) return null;
  await connectDB();
  const user = await User.findById(claims.sub).select("name email role emailVerified sessionVersion").lean();
  if (!user || user.role !== claims.role || user.sessionVersion !== claims.sv) return null;
  // Unverified accounts never get sessions; this also covers tokens minted before a policy change.
  if (!user.emailVerified) return null;
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified };
}

/** For Server Components: cached per request via React cache(). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return getSessionUserFromToken(store.get(SESSION_COOKIE)?.value);
});
