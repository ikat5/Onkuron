import { Schema, type Types } from "mongoose";
import { model } from "./util";

/**
 * One document per student and lesson. Playback numbers are reported by the
 * browser, so the server clamps them (see services/progress.ts); completion
 * is either explicit or earned by actually watching most of the video.
 */
export interface ILessonProgress {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  lessonId: Types.ObjectId;
  /** Video the playback numbers refer to; when the teacher replaces the video they restart. */
  videoKey?: string;
  positionSeconds: number;
  durationSeconds: number;
  /** Seconds of real playback (seeking does not count), capped at the duration. */
  watchedSeconds: number;
  lastReportAt?: Date;
  completed: boolean;
  completedAt?: Date;
  completedBy?: "manual" | "watched";
  createdAt: Date;
  updatedAt: Date;
}

const LessonProgressSchema = new Schema<ILessonProgress>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    videoKey: { type: String, maxlength: 200 },
    positionSeconds: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    watchedSeconds: { type: Number, default: 0, min: 0 },
    lastReportAt: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    completedBy: { type: String, enum: ["manual", "watched"] },
  },
  { timestamps: true },
);

LessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
LessonProgressSchema.index({ studentId: 1, courseId: 1 });
LessonProgressSchema.index({ lessonId: 1 });

export const LessonProgress = model<ILessonProgress>("LessonProgress", LessonProgressSchema);
