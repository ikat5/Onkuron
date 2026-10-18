import "server-only";
import { Course } from "@/models/Course";
import type { CourseOption } from "./teacher-editor";

export async function courseOptions(): Promise<CourseOption[]> {
  const courses = await Course.find().sort({ createdAt: -1 }).select("title published").lean();
  return courses.map((c) => ({ id: String(c._id), title: c.title, published: c.published }));
}
