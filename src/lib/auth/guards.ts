import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./current";
import type { Role } from "@/models/User";

/**
 * Server Component guard. Redirects anonymous visitors to /login and hides
 * pages from users with the wrong role (404 rather than revealing the route).
 */
export async function requireUser(nextPath: string, role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (role && user.role !== role) notFound();
  return user;
}
