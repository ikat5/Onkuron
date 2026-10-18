import "server-only";
import { Types } from "mongoose";
import { forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/current";
import type { ProgressInput } from "@/lib/validation";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { LessonProgress, type ILessonProgress } from "@/models/LessonProgress";
import { hasApprovedEnrollment } from "./enrollment";
import { videoKeyOf } from "./lessons";

/** Share of the video a student must actually play before the lesson completes on its own. */
export const AUTO_COMPLETE_RATIO = 0.9;
/** Fastest YouTube playback rate; bounds how much watching can happen per wall-clock second. */
const MAX_RATE = 2;

export interface ProgressDTO {
  lessonId: string;
  completed: boolean;
  positionSeconds: number;
  durationSeconds: number;
  watchedSeconds: number;
  /** 0–100, share of the video actually played. */
  percent: number;
}

export function toProgressDTO(p: Pick<ILessonProgress, "lessonId" | "completed" | "positionSeconds" | "durationSeconds" | "watchedSeconds">): ProgressDTO {
  const percent = p.durationSeconds > 0 ? Math.min(100, Math.round((p.watchedSeconds / p.durationSeconds) * 100)) : 0;
  return {
    lessonId: String(p.lessonId),
    completed: p.completed,
    positionSeconds: Math.floor(p.positionSeconds),
    durationSeconds: Math.floor(p.durationSeconds),
    watchedSeconds: Math.floor(p.watchedSeconds),
    percent: p.completed ? Math.max(percent, 100) : percent,
  };
}

/** Lessons of a course the student can access. Throws unless the enrollment is approved. */
export async function assertLearner(user: SessionUser, courseId: Types.ObjectId | string) {
  if (user.role === "teacher") return;
  const course = await Course.findOne({ _id: courseId, published: true }).select("_id").lean();
  if (!course || !(await hasApprovedEnrollment(user.id, courseId))) {
    throw forbidden("You need an approved enrollment to access this content.");
  }
}

export async function listCourseProgress(studentId: string, courseId: Types.ObjectId | string) {
  const docs = await LessonProgress.find({ studentId: new Types.ObjectId(studentId), courseId }).lean();
  return docs.map(toProgressDTO);
}

/**
 * Records a playback heartbeat and/or an explicit completion toggle.
 * Reported numbers are clamped: positions to the duration, and "watched"
 * time to what real playback at ≤2× speed could produce since the previous
 * report, so a crafted request can't instantly complete a lesson.
 */
export async function recordProgress(student: SessionUser, lessonId: string, input: ProgressInput) {
  if (student.role !== "student") throw forbidden("Only students have lesson progress.");
  if (!Types.ObjectId.isValid(lessonId)) throw notFound("Lesson not found");
  const lesson = await Lesson.findById(lessonId).select("courseId youtubeVideoId video").lean();
  if (!lesson) throw notFound("Lesson not found");
  await assertLearner(student, lesson.courseId);

  const studentId = new Types.ObjectId(student.id);
  const now = new Date();
  const key = videoKeyOf(lesson);
  const existing = await LessonProgress.findOne({ studentId, lessonId: lesson._id }).lean();

  // Numbers from an outdated video (the teacher replaced it) start over; completion is kept.
  const sameVideo = existing?.videoKey === key;
  let duration = sameVideo ? existing!.durationSeconds : 0;
  let watched = sameVideo ? existing!.watchedSeconds : 0;
  let position = sameVideo ? existing!.positionSeconds : 0;
  let completed = existing?.completed ?? false;
  let completedBy = existing?.completedBy;
  let completedAt = existing?.completedAt;

  const isHeartbeat = key !== undefined && input.videoKey === key;
  if (isHeartbeat) {
    if (input.durationSeconds && input.durationSeconds > 0) duration = input.durationSeconds;
    if (input.positionSeconds !== undefined) position = duration ? Math.min(input.positionSeconds, duration) : input.positionSeconds;
    if (input.watchedDelta) {
      const elapsed = sameVideo && existing?.lastReportAt ? (now.getTime() - existing.lastReportAt.getTime()) / 1000 : 30;
      const allowed = Math.max(0, elapsed * MAX_RATE + 2);
      watched += Math.min(input.watchedDelta, allowed);
      if (duration) watched = Math.min(watched, duration);
    }
    if (!completed && duration > 0 && watched >= duration * AUTO_COMPLETE_RATIO) {
      completed = true;
      completedBy = "watched";
      completedAt = now;
    }
  }
  if (input.completed !== undefined && input.completed !== completed) {
    completed = input.completed;
    completedBy = completed ? "manual" : undefined;
    completedAt = completed ? now : undefined;
  }

  const doc = await LessonProgress.findOneAndUpdate(
    { studentId, lessonId: lesson._id },
    {
      $set: {
        courseId: lesson.courseId,
        videoKey: key,
        positionSeconds: position,
        durationSeconds: duration,
        watchedSeconds: watched,
        completed,
        ...(isHeartbeat ? { lastReportAt: now } : {}),
        ...(completed ? { completedBy, completedAt } : {}),
      },
      ...(completed ? {} : { $unset: { completedBy: 1, completedAt: 1 } }),
    },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return toProgressDTO(doc!);
}
