import { Schema, type Types } from "mongoose";
import { model } from "./util";
import { AssetSchema, type IAsset } from "./Course";

export type FileResourceKind = "pdf" | "slides" | "document";
export type ResourceKind = FileResourceKind | "link";
export type VideoProvider = "youtube" | "cloudinary";

export interface IResource {
  _id: Types.ObjectId;
  title: string;
  kind: ResourceKind;
  /** Uploaded file (pdf/slides/document). */
  asset?: IAsset;
  /** External learning link (kind "link"); always an https URL validated on the server. */
  url?: string;
}

export interface ILesson {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  description: string;
  order: number;
  /**
   * "youtube" when youtubeVideoId is set. Lessons created before YouTube
   * hosting may still carry a legacy Cloudinary `video` asset ("cloudinary");
   * it keeps playing until the teacher sets a YouTube URL, which replaces it.
   */
  videoProvider?: VideoProvider;
  /** Validated 11-character ID, extracted server-side from a YouTube URL. */
  youtubeVideoId?: string;
  /** @deprecated Legacy Cloudinary upload. New lessons use YouTube. */
  video?: IAsset;
  resources: Types.DocumentArray<IResource & Types.Subdocument>;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    kind: { type: String, enum: ["pdf", "slides", "document", "link"], required: true },
    asset: { type: AssetSchema, required: function (this: IResource) { return this.kind !== "link"; } },
    url: { type: String, maxlength: 2000, required: function (this: IResource) { return this.kind === "link"; } },
  },
  { timestamps: true },
);

const LessonSchema = new Schema<ILesson>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 5000 },
    order: { type: Number, required: true, default: 0 },
    videoProvider: { type: String, enum: ["youtube", "cloudinary"] },
    youtubeVideoId: { type: String, match: /^[A-Za-z0-9_-]{11}$/ },
    video: AssetSchema,
    resources: { type: [ResourceSchema], default: [] },
  },
  { timestamps: true },
);

LessonSchema.index({ courseId: 1, order: 1 });

export const Lesson = model<ILesson>("Lesson", LessonSchema);
