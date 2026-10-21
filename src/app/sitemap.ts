import type { MetadataRoute } from "next";
import { COURSE_CATEGORIES } from "@/lib/categories";
import { connectDB } from "@/lib/db";
import { TEAMS } from "@/lib/team";
import { Course } from "@/models/Course";
import { TeacherProfile } from "@/models/TeacherProfile";

// Built per request so new courses appear immediately (never prerendered from build-time data).
export const dynamic = "force-dynamic";

/** Public pages, published courses and published team profiles only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const pages: MetadataRoute.Sitemap = ["", "/courses", "/teachers", "/developers", "/editors", "/about", "/contact", "/privacy", "/terms"].map((p) => ({ url: `${base}${p}` }));
  const categories = COURSE_CATEGORIES.map((c) => ({ url: `${base}/courses?category=${c.id}` }));
  try {
    await connectDB();
    const [courses, profiles] = await Promise.all([
      Course.find({ published: true }).select("slug updatedAt").lean(),
      TeacherProfile.find({ published: true }).select("team slug updatedAt").lean(),
    ]);
    return [
      ...pages,
      ...categories,
      ...courses.map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updatedAt })),
      ...profiles.map((p) => ({ url: `${base}${TEAMS[p.team ?? "teacher"].publicPath}/${p.slug}`, lastModified: p.updatedAt })),
    ];
  } catch {
    return [...pages, ...categories];
  }
}
