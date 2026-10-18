import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/learn/", "/admin", "/account", "/verify-email", "/reset-password"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
