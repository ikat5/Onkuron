import { Schema, type Types } from "mongoose";
import type { Team } from "@/lib/team";
import { model } from "./util";
import { AssetSchema, type IAsset } from "./Course";

export interface IAchievement {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  year?: number;
  order: number;
}

/**
 * A public profile of a teacher, developer or video editor (see src/lib/team.ts). Profiles are content
 * managed from the (shared) teacher account — they are not login accounts.
 * Nothing here is public until `published` is true.
 */
export interface ITeacherProfile {
  _id: Types.ObjectId;
  /** Absent on profiles saved before teams existed (those are teachers). */
  team?: Team;
  published: boolean;
  /** Position on the public Teachers page (ascending). */
  order: number;
  displayName: string;
  slug: string;
  headline?: string;
  /** Degree and institution, e.g. "B.Sc. in CSE, BUET". */
  qualification?: string;
  /** Public social profiles (https, host-checked on input). */
  facebookUrl?: string;
  youtubeChannelUrl?: string;
  shortBio: string;
  bio: string;
  philosophy?: string;
  subjects: string[];
  expertise: string[];
  achievements: Types.DocumentArray<IAchievement & Types.Subdocument>;
  /** Courses this teacher teaches (only published ones are shown publicly). */
  courseIds: Types.ObjectId[];
  photo?: IAsset;
  /** Validated YouTube video ID for an optional introduction video. */
  youtubeVideoId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AchievementSchema = new Schema<IAchievement>({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 400 },
  year: { type: Number, min: 1950, max: 2100 },
  order: { type: Number, default: 0 },
});

const TeacherProfileSchema = new Schema<ITeacherProfile>(
  {
    team: { type: String, enum: ["teacher", "developer", "editor"], default: "teacher" },
    published: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 80 },
    headline: { type: String, trim: true, maxlength: 120 },
    qualification: { type: String, trim: true, maxlength: 160 },
    facebookUrl: { type: String, trim: true, maxlength: 300 },
    youtubeChannelUrl: { type: String, trim: true, maxlength: 300 },
    shortBio: { type: String, default: "", maxlength: 300 },
    bio: { type: String, default: "", maxlength: 5000 },
    philosophy: { type: String, maxlength: 1500 },
    subjects: { type: [String], default: [] },
    expertise: { type: [String], default: [] },
    achievements: { type: [AchievementSchema], default: [] },
    courseIds: { type: [{ type: Schema.Types.ObjectId, ref: "Course" }], default: [] },
    photo: AssetSchema,
    youtubeVideoId: { type: String, match: /^[A-Za-z0-9_-]{11}$/ },
  },
  { timestamps: true },
);

TeacherProfileSchema.index({ slug: 1 }, { unique: true });
TeacherProfileSchema.index({ team: 1, published: 1, order: 1 });

export const TeacherProfile = model<ITeacherProfile>("TeacherProfile", TeacherProfileSchema);
