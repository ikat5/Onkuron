import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import { TEAMS } from "@/lib/team";
import { Category } from "@/models/Category";
import { Course } from "@/models/Course";
import { TeacherProfile } from "@/models/TeacherProfile";

// Built per request so new courses appear immediately (never prerendered from build-time data).
export const dynamic = "force-dynamic";

/** Public pages plus published courses, team profiles and categories only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const pages: MetadataRoute.Sitemap = ["", "/courses", "/teachers", "/developers", "/editors", "/about", "/contact", "/privacy", "/terms"].map((p) => ({ url: `${base}${p}` }));
  try {
    await connectDB();
    const [courses, profiles, categories] = await Promise.all([
      Course.find({ published: true }).select("slug updatedAt").lean(),
      TeacherProfile.find({ published: true }).select("team slug updatedAt").lean(),
      Category.find({ published: true }).sort({ order: 1 }).select("slug").lean(),
    ]);
    return [
      ...pages,
      ...categories.map((c) => ({ url: `${base}/courses?category=${c.slug}` })),
      ...courses.map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updatedAt })),
      ...profiles.map((p) => ({ url: `${base}${TEAMS[p.team ?? "teacher"].publicPath}/${p.slug}`, lastModified: p.updatedAt })),
    ];
  } catch {
    return pages;
  }
}
