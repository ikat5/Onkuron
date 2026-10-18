import type { NextConfig } from "next";

// Security headers that do not depend on a per-request nonce.
// The Content-Security-Policy (which needs a nonce) is set in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mongoose", "cloudinary", "nodemailer"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // The admin panel moved from /teacher to /admin; keep old bookmarks working.
  async redirects() {
    return [
      { source: "/teacher", destination: "/admin", permanent: false },
      { source: "/teacher/profile", destination: "/admin/teachers", permanent: false },
      { source: "/teacher/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Token-bearing pages must never leak the token through the Referer header.
      {
        source: "/(verify-email|reset-password)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
