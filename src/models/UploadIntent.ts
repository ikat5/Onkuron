import { Schema, type Types } from "mongoose";
import { model } from "./util";

export const UPLOAD_KIND_IDS = ["thumbnail", "teacher_photo", "team_photo", "promo_thumbnail", "promo_video", "category_image", "video", "pdf", "slides", "document"] as const;
export type UploadKind = (typeof UPLOAD_KIND_IDS)[number];

/**
 * Created when the server signs a direct upload. Completing an upload must
 * match an unconsumed, unexpired intent, so clients cannot register arbitrary
 * Cloudinary assets as course material.
 */
export interface IUploadIntent {
  _id: Types.ObjectId;
  kind: UploadKind;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  deliveryType: "upload" | "authenticated";
  /** Absent for uploads that don't belong to a course (the teacher profile photo). */
  courseId?: Types.ObjectId;
  lessonId?: Types.ObjectId;
  /** Teacher profile receiving a "teacher_photo" upload. */
  profileId?: Types.ObjectId;
  /** Category receiving a "category_image" upload. */
  targetId?: Types.ObjectId;
  /** Resource being replaced, when replacing a lesson resource. */
  resourceId?: Types.ObjectId;
  title?: string;
  originalFilename: string;
  declaredBytes: number;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

const UploadIntentSchema = new Schema<IUploadIntent>(
  {
    kind: { type: String, enum: UPLOAD_KIND_IDS, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
    deliveryType: { type: String, enum: ["upload", "authenticated"], required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson" },
    profileId: { type: Schema.Types.ObjectId, ref: "TeacherProfile" },
    targetId: { type: Schema.Types.ObjectId },
    resourceId: { type: Schema.Types.ObjectId },
    title: { type: String, maxlength: 150 },
    originalFilename: { type: String, required: true, maxlength: 255 },
    declaredBytes: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

UploadIntentSchema.index({ publicId: 1 }, { unique: true });
UploadIntentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const UploadIntent = model<IUploadIntent>("UploadIntent", UploadIntentSchema);
