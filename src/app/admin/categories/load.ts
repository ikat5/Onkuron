import "server-only";
import { Category } from "@/models/Category";
import { Course } from "@/models/Course";

export interface CategoryCourseOption {
  id: string;
  title: string;
  published: boolean;
  /** Slug and name of the category the course is filed under now. */
  category?: string;
  categoryName?: string;
}

export async function categoryCourseOptions(): Promise<CategoryCourseOption[]> {
  const [courses, categories] = await Promise.all([Course.find().sort({ createdAt: -1 }).select("title published category").lean(), Category.find().select("slug name").lean()]);
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  return courses.map((c) => ({ id: String(c._id), title: c.title, published: c.published, category: c.category, categoryName: c.category ? names.get(c.category) : undefined }));
}
