import { Schema, type Types } from "mongoose";
import { CATEGORY_SLUG_RE } from "@/lib/categories";
import { model } from "./util";

/** Trusted metadata of a Cloudinary asset, verified server-side via the Admin API. */
export interface IAsset {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  deliveryType: "upload" | "authenticated";
  format?: string;
  bytes: number;
  version: number;
  originalFilename?: string;
  duration?: number;
  /** Public delivery URL; only stored for public assets such as thumbnails. */
  url?: string;
  uploadedAt: Date;
}

export const AssetSchema = new Schema<IAsset>(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
    deliveryType: { type: String, enum: ["upload", "authenticated"], required: true },
    format: String,
    bytes: { type: Number, required: true },
    version: { type: Number, required: true },
    originalFilename: String,
    duration: Number,
    url: String,
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface ICourse {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  summary: string;
  description: string;
  /** Price in BDT (whole taka). Always read from the database, never from the client. */
  price: number;
  /** Slug of a Category document (checked by the course service); optional for uncategorised courses. */
  category?: string;
  thumbnail?: IAsset;
  published: boolean;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    summary: { type: String, default: "", maxlength: 300 },
    description: { type: String, default: "", maxlength: 10000 },
    price: { type: Number, required: true, min: 0, max: 1_000_000 },
    category: { type: String, maxlength: 60, match: CATEGORY_SLUG_RE },
    thumbnail: AssetSchema,
    published: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CourseSchema.index({ slug: 1 }, { unique: true });
CourseSchema.index({ published: 1, createdAt: -1 });
CourseSchema.index({ published: 1, category: 1 });

export const Course = model<ICourse>("Course", CourseSchema);
