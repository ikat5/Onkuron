import { Schema, type Types } from "mongoose";
import { model } from "./util";

/**
 * Append-only audit trail. Teacher actions are attributed to the *shared*
 * teacher account — they do not identify which individual teacher acted.
 */
export interface IAuditLog {
  _id: Types.ObjectId;
  action: string;
  actorId?: Types.ObjectId;
  actorRole: "student" | "teacher" | "system" | "anonymous";
  targetType?: string;
  targetId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String, enum: ["student", "teacher", "system", "anonymous"], required: true },
    targetType: String,
    targetId: String,
    ip: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);
