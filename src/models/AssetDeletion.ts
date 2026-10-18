import { Schema, type Types } from "mongoose";
import { model } from "./util";

/** Durable queue of Cloudinary assets to delete once they are no longer referenced. */
export interface IAssetDeletion {
  _id: Types.ObjectId;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  deliveryType: "upload" | "authenticated";
  reason: string;
  status: "pending" | "done" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssetDeletionSchema = new Schema<IAssetDeletion>(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
    deliveryType: { type: String, enum: ["upload", "authenticated"], required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "done", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: Date,
    lastError: String,
  },
  { timestamps: true },
);

AssetDeletionSchema.index({ publicId: 1 }, { unique: true });
AssetDeletionSchema.index({ status: 1, nextAttemptAt: 1 });

export const AssetDeletion = model<IAssetDeletion>("AssetDeletion", AssetDeletionSchema);
