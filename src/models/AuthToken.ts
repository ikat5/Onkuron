import { Schema, type Types } from "mongoose";
import { model } from "./util";

export type TokenPurpose = "email_verification" | "password_reset";

/** Single-use tokens. Only a SHA-256 hash of the raw token is stored. */
export interface IAuthToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const AuthTokenSchema = new Schema<IAuthToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["email_verification", "password_reset"], required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuthTokenSchema.index({ tokenHash: 1 }, { unique: true });
AuthTokenSchema.index({ userId: 1, purpose: 1 });
// Cleanup: MongoDB's TTL monitor removes tokens a day after they expire.
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const AuthToken = model<IAuthToken>("AuthToken", AuthTokenSchema);
