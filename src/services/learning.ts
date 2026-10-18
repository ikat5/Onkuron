import "server-only";
import { Types } from "mongoose";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/current";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { LessonProgress } from "@/models/LessonProgress";
import { toLessonDTO } from "./lessons";
import { assertLearner, listCourseProgress, toProgressDTO } from "./progress";

/**
 * Protected course content for the learning page and the learner APIs. Lesson
 * descriptions, video IDs and resources are only returned after the server
 * has confirmed an approved enrollment (or the teacher role).
 */
export async function getCourseForLearner(user: SessionUser, where: { slug: string } | { courseId: string }) {
  if ("courseId" in where && !Types.ObjectId.isValid(where.courseId)) throw notFound("Course not found");
  const filter = "slug" in where ? { slug: where.slug } : { _id: where.courseId };
  const course = await Course.findOne({ ...filter, ...(user.role === "teacher" ? {} : { published: true }) }).lean();
  if (!course) throw notFound("Course not found");
  try {
    await assertLearner(user, course._id);
  } catch (err) {
    await audit({ action: "learn.denied", actor: user, targetType: "course", targetId: String(course._id) });
    throw err;
  }
  const lessons = await Lesson.find({ courseId: course._id }).sort({ order: 1, createdAt: 1 }).lean();
  const progress = user.role === "student" ? await listCourseProgress(user.id, course._id) : [];
  return {
    course: { id: String(course._id), title: course.title, slug: course.slug, summary: course.summary, published: course.published },
    lessons: lessons.map(toLessonDTO),
    progress,
  };
}

export async function getLessonForLearner(user: SessionUser, lessonId: string) {
  if (!Types.ObjectId.isValid(lessonId)) throw notFound("Lesson not found");
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw notFound("Lesson not found");
  await assertLearner(user, lesson.courseId);
  const progress =
    user.role === "student" ? await LessonProgress.findOne({ studentId: new Types.ObjectId(user.id), lessonId: lesson._id }).lean() : null;
  return { lesson: toLessonDTO(lesson), progress: progress ? toProgressDTO(progress) : null };
}
