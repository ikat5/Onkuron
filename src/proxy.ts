import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before routing. Responsibilities:
 * 1. A per-request nonce-based Content-Security-Policy.
 * 2. Optimistic redirect to /login for protected areas when no session cookie
 *    is present. This is a UX shortcut only — every page and API route still
 *    performs full authentication and authorization on the server.
 */

const PROTECTED = ["/dashboard", "/learn", "/admin", "/account"];
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-onkuron_session" : "onkuron_session";

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // The YouTube IFrame API is injected by our own (nonce-trusted) code, which 'strict-dynamic' allows;
    // the host is listed for browsers without CSP3 support.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.youtube.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://i.ytimg.com",
    // Lesson videos: privacy-enhanced YouTube embeds only.
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    "connect-src 'self' https://api.cloudinary.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.has(COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|brand/|favicon.ico|icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
