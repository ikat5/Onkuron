import { Schema, type Types } from "mongoose";
import { model } from "./util";

export type OutboxStatus = "pending" | "sending" | "sent" | "failed" | "dead";

export interface IDeliveryAttempt {
  at: Date;
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Transactional email outbox. Records are created in the same logical step as
 * the state change that triggers them; delivery happens separately with
 * bounded retries. `idempotencyKey` prevents duplicate notifications for the
 * same event. Payloads never contain secrets or single-use tokens.
 */
export interface IEmailOutbox {
  _id: Types.ObjectId;
  idempotencyKey: string;
  template: string;
  to: string;
  data: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedUntil?: Date;
  lastError?: string;
  sentAt?: Date;
  history: IDeliveryAttempt[];
  createdAt: Date;
  updatedAt: Date;
}

const EmailOutboxSchema = new Schema<IEmailOutbox>(
  {
    idempotencyKey: { type: String, required: true },
    template: { type: String, required: true },
    to: { type: String, required: true, lowercase: true },
    data: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "sending", "sent", "failed", "dead"], default: "pending" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 6 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: Date,
    lastError: { type: String, maxlength: 500 },
    sentAt: Date,
    history: {
      type: [{ at: Date, ok: Boolean, error: String, messageId: String, _id: false }],
      default: [],
    },
  },
  { timestamps: true, minimize: false },
);

EmailOutboxSchema.index({ idempotencyKey: 1 }, { unique: true });
EmailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
EmailOutboxSchema.index({ createdAt: -1 });

export const EmailOutbox = model<IEmailOutbox>("EmailOutbox", EmailOutboxSchema);
