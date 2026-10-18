import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { getAuthEnv, isProduction } from "@/lib/env";
import type { Role } from "@/models/User";

export const SESSION_COOKIE = sessionCookieName();

function sessionCookieName() {
  // The __Host- prefix forces Secure, Path=/ and no Domain — only possible over HTTPS.
  return process.env.NODE_ENV === "production" ? "__Host-onkuron_session" : "onkuron_session";
}

export interface SessionClaims {
  sub: string;
  role: Role;
  /** Session version; must match the user's current sessionVersion. */
  sv: number;
}

const ISSUER = "onkuron-lms";
const AUDIENCE = "onkuron-web";

function key() {
  return new TextEncoder().encode(getAuthEnv().JWT_SECRET);
}

export async function signSession(claims: SessionClaims): Promise<{ token: string; maxAge: number }> {
  const maxAge = getAuthEnv().SESSION_TTL_HOURS * 3600;
  const token = await new SignJWT({ role: claims.role, sv: claims.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(key());
  return { token, maxAge };
}

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    if (payload.role !== "student" && payload.role !== "teacher") return null;
    return { sub: payload.sub, role: payload.role, sv: payload.sv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
