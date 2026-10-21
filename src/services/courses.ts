import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import type { CourseInput } from "@/lib/validation";
import { Course, type ICourse } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { Lesson } from "@/models/Lesson";
import { LessonProgress } from "@/models/LessonProgress";
import { queueAssetDeletion } from "./assets";
import { assertCategoryExists, categoryLookup } from "./categories";

/** URL slug generated from a title or name; `fallback` prefixes a random one when it has no Latin letters or digits (e.g. Bangla). */
export function slugify(title: string, fallback = "course"): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `${fallback}-${randomBytes(3).toString("hex")}`;
}

function assertId(id: string, what = "Course") {
  if (!Types.ObjectId.isValid(id)) throw notFound(`${what} not found`);
}

export async function createCourse(teacher: SessionUser, input: CourseInput, ip: string) {
  if (input.category) await assertCategoryExists(input.category);
  // The URL is generated from the title once and never changes, so shared links keep working.
  let slug = slugify(input.title);
  if (await Course.exists({ slug })) slug = `${slug}-${randomBytes(2).toString("hex")}`;
  try {
    const course = await Course.create({
      title: input.title,
      slug,
      summary: input.summary,
      description: input.description,
      price: input.price,
      ...(input.category ? { category: input.category } : {}),
      published: input.published,
    });
    await audit({ action: "course.created", actor: teacher, targetType: "course", targetId: String(course._id), ip });
    return course;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict("A course with a very similar title was created at the same moment. Please save again.");
    throw err;
  }
}

export async function updateCourse(teacher: SessionUser, id: string, input: Partial<CourseInput>, ip: string) {
  assertId(id);
  if (input.category) await assertCategoryExists(input.category);
  // Explicit allow-list of updatable fields (no mass assignment).
  const update: Partial<Pick<ICourse, "title" | "summary" | "description" | "price" | "published" | "category">> = {};
  for (const key of ["title", "summary", "description", "price", "published", "category"] as const) {
    if (input[key] !== undefined && input[key] !== "") (update as Record<string, unknown>)[key] = input[key];
  }
  const ops: Record<string, unknown> = { $set: update };
  if (input.category === "") ops.$unset = { category: 1 };
  const course = await Course.findByIdAndUpdate(id, ops, { returnDocument: "after", runValidators: true }).lean();
  if (!course) throw notFound("Course not found");
  await audit({ action: "course.updated", actor: teacher, targetType: "course", targetId: id, ip, metadata: { fields: Object.keys(update) } });
  return course;
}

/** Courses with enrollments are never hard-deleted (keeps the payment audit trail); unpublish them instead. */
export async function deleteCourse(teacher: SessionUser, id: string, ip: string) {
  assertId(id);
  if (await Enrollment.exists({ courseId: id })) {
    throw badRequest("This course has enrollment records. Unpublish it instead of deleting it.");
  }
  const course = await Course.findByIdAndDelete(id).lean();
  if (!course) throw notFound("Course not found");
  const lessons = await Lesson.find({ courseId: id }).lean();
  await Lesson.deleteMany({ courseId: id });
  await LessonProgress.deleteMany({ courseId: id });
  const assets = [course.thumbnail, ...lessons.flatMap((l) => [l.video, ...l.resources.map((r) => r.asset)])];
  await Promise.all(assets.map((a) => (a ? queueAssetDeletion(a, "course_deleted") : null)));
  await audit({ action: "course.deleted", actor: teacher, targetType: "course", targetId: id, ip });
}

/** Public catalogue data only — no lesson descriptions or asset references. */
export async function listPublishedCourses(opts: { category?: string; limit?: number; excludeIds?: Types.ObjectId[]; onlyIds?: string[] } = {}) {
  const filter: Record<string, unknown> = { published: true };
  if (opts.category && /^[a-z0-9-]{1,60}$/.test(opts.category)) filter.category = opts.category;
  if (opts.excludeIds?.length) filter._id = { $nin: opts.excludeIds };
  if (opts.onlyIds) filter._id = { $in: opts.onlyIds.filter((id) => Types.ObjectId.isValid(id)) };
  const query = Course.find(filter).sort({ createdAt: -1 }).select("-description");
  const courses = await (opts.limit ? query.limit(opts.limit) : query).lean();
  const ids = courses.map((c) => c._id);
  const [counts, students, categories] = await Promise.all([
    Lesson.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { courseId: { $in: ids } } }, { $group: { _id: "$courseId", n: { $sum: 1 } } }]),
    // A purchase counts once the teacher has approved the payment.
    Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { courseId: { $in: ids }, status: "approved" } }, { $group: { _id: "$courseId", n: { $sum: 1 } } }]),
    categoryLookup(),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  const studentsById = new Map(students.map((c) => [String(c._id), c.n]));
  return courses.map((c) => {
    const cat = c.category ? categories.get(c.category) : undefined;
    return { ...c, lessonCount: byId.get(String(c._id)) ?? 0, studentCount: studentsById.get(String(c._id)) ?? 0, categoryName: cat?.published ? cat.name : undefined, categoryIcon: cat?.icon };
  });
}

export async function getPublicCourse(slug: string) {
  const course = await Course.findOne({ slug, published: true }).lean();
  if (!course) return null;
  // Only titles are public (a syllabus); descriptions and media require enrollment.
  const [lessons, categories] = await Promise.all([Lesson.find({ courseId: course._id }).sort({ order: 1, createdAt: 1 }).select("title order").lean(), course.category ? categoryLookup() : null]);
  const category = course.category ? categories?.get(course.category) : undefined;
  return { course, lessons, categoryName: category?.published ? category.name : undefined };
}
