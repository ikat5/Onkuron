import { Schema, type Types } from "mongoose";
import { model } from "./util";

export type Role = "student" | "teacher";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  /** Incremented to revoke every existing session for this account. */
  sessionVersion: number;
  failedLoginCount: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "teacher"], required: true, default: "student" },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    sessionVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
// At most one teacher document can ever exist: the shared teacher account.
UserSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: "teacher" }, name: "single_teacher" });

export const User = model<IUser>("User", UserSchema);
