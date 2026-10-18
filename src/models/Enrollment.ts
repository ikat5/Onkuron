import { Schema, type Types } from "mongoose";
import { model } from "./util";

export type EnrollmentStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "bkash" | "nagad" | "rocket";

export interface IEnrollment {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  status: EnrollmentStatus;
  /**
   * true while pending or approved. Partial unique indexes on this flag allow a
   * student to resubmit after rejection while preventing duplicates otherwise.
   */
  active: boolean;
  /** Price copied from the course at submission time (server-side). */
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  senderNumber: string;
  decidedAt?: Date;
  decisionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    active: { type: Boolean, default: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["bkash", "nagad", "rocket"], required: true },
    transactionId: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
    senderNumber: { type: String, required: true, trim: true, maxlength: 20 },
    decidedAt: Date,
    decisionReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

EnrollmentSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: "one_active_enrollment" },
);
EnrollmentSchema.index(
  { paymentMethod: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: "unique_active_transaction" },
);
EnrollmentSchema.index({ status: 1, createdAt: -1 });
EnrollmentSchema.index({ studentId: 1, createdAt: -1 });

export const Enrollment = model<IEnrollment>("Enrollment", EnrollmentSchema);
