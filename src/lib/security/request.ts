import "server-only";
import { getAppUrl, getAuthEnv } from "@/lib/env";

/** Client IP. Forwarded headers are only trusted when TRUST_PROXY=true. */
export function clientIp(headers: Headers): string {
  if (getAuthEnv().TRUST_PROXY) {
    const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd.slice(0, 64);
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  }
  return "local";
}

/**
 * CSRF defence for cookie-authenticated mutations. Combined with
 * SameSite=Lax cookies and a required JSON content type (which cross-site
 * HTML forms cannot send without a CORS preflight we never approve), this
 * rejects requests whose Origin is not the configured application origin.
 */
export function isTrustedOrigin(headers: Headers): boolean {
  const appOrigin = new URL(getAppUrl()).origin;
  const origin = headers.get("origin");
  if (origin) return origin === appOrigin;
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  // Non-browser clients send neither header; they cannot carry a victim's cookies.
  return true;
}

/** Only allow same-site relative redirects such as "/dashboard" (no "//evil.com"). */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  return next.slice(0, 512);
}
