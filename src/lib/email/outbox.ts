import "server-only";
import { after } from "next/server";
import type { ClientSession, Types } from "mongoose";
import { ConfigError } from "@/lib/env";
import { logger } from "@/lib/logger";
import { EmailOutbox } from "@/models/EmailOutbox";
import { EmailDeliveryError, sendEmailNow } from "./service";
import type { TemplateData, TemplateName } from "./templates";

const LOCK_MS = 2 * 60_000;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;

export function backoffMs(attempt: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp * (0.8 + Math.random() * 0.4));
}

/**
 * Durably records an email to send. Idempotent: a second call with the same
 * key (e.g. the same enrollment decision) does not create a duplicate.
 */
export async function enqueueEmail<T extends TemplateName>(
  input: { idempotencyKey: string; template: T; to: string; data: TemplateData[T] },
  session?: ClientSession,
): Promise<{ id: Types.ObjectId | null; created: boolean }> {
  const res = await EmailOutbox.updateOne(
    { idempotencyKey: input.idempotencyKey },
    {
      $setOnInsert: {
        idempotencyKey: input.idempotencyKey,
        template: input.template,
        to: input.to.toLowerCase(),
        data: input.data,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        history: [],
      },
    },
    { upsert: true, session },
  );
  const created = res.upsertedCount === 1;
  return { id: created ? (res.upsertedId as Types.ObjectId) : null, created };
}

/** Atomically claims one due message so concurrent workers never double-send. */
async function claim(filter: Record<string, unknown>) {
  const now = new Date();
  return EmailOutbox.findOneAndUpdate(
    {
      ...filter,
      status: { $in: ["pending", "failed", "sending"] },
      nextAttemptAt: { $lte: now },
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: null }, { lockedUntil: { $lt: now } }],
    },
    { $set: { status: "sending", lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
    { returnDocument: "after", sort: { nextAttemptAt: 1 } },
  );
}

export async function deliver(doc: NonNullable<Awaited<ReturnType<typeof claim>>>) {
  const at = new Date();
  try {
    const { messageId } = await sendEmailNow(doc.template as TemplateName, doc.to, doc.data as never);
    await EmailOutbox.updateOne(
      { _id: doc._id },
      {
        $set: { status: "sent", sentAt: at, lastError: undefined },
        $unset: { lockedUntil: 1 },
        $push: { history: { $each: [{ at, ok: true, messageId }], $slice: -20 } },
      },
    );
    return "sent" as const;
  } catch (err) {
    const notConfigured = err instanceof ConfigError;
    const transient = notConfigured || !(err instanceof EmailDeliveryError) || err.transient;
    const message = notConfigured
      ? "Email is not configured"
      : err instanceof EmailDeliveryError
        ? err.message
        : "Unexpected error while sending";
    if (!(err instanceof EmailDeliveryError) && !notConfigured) logger.error("outbox.unexpected", { error: err });
    const exhausted = doc.attempts >= doc.maxAttempts || !transient;
    await EmailOutbox.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: exhausted ? "dead" : "failed",
          lastError: message,
          nextAttemptAt: new Date(at.getTime() + (notConfigured ? 10 * 60_000 : backoffMs(doc.attempts))),
        },
        $unset: { lockedUntil: 1 },
        // A missing configuration is not the message's fault; don't burn its attempts.
        ...(notConfigured ? { $inc: { attempts: -1 } } : {}),
        $push: { history: { $each: [{ at, ok: false, error: message }], $slice: -20 } },
      },
    );
    return exhausted ? ("dead" as const) : ("failed" as const);
  }
}

export async function processOutboxItem(id: Types.ObjectId | string) {
  const doc = await claim({ _id: id });
  return doc ? deliver(doc) : null;
}

/** Processes up to `limit` due messages. Safe to run from several workers at once. */
export async function processDueOutbox(limit = 20) {
  const results = { sent: 0, failed: 0, dead: 0 };
  for (let i = 0; i < limit; i++) {
    const doc = await claim({});
    if (!doc) break;
    results[await deliver(doc)]++;
  }
  return results;
}

/** Teacher action: re-queue a failed or dead message for immediate delivery. */
export async function retryOutboxItem(id: Types.ObjectId | string) {
  const doc = await EmailOutbox.findOneAndUpdate(
    { _id: id, status: { $in: ["failed", "dead"] } },
    [
      {
        $set: {
          status: "pending",
          nextAttemptAt: "$$NOW",
          maxAttempts: { $max: ["$maxAttempts", { $add: ["$attempts", 3] }] },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );
  if (!doc) return null;
  return processOutboxItem(doc._id);
}

/**
 * Attempts delivery right after the response is sent (Next.js `after`). If
 * this runtime is killed first, the message stays in the outbox and the worker
 * or cron endpoint delivers it later.
 */
export function dispatchSoon(ids: Array<Types.ObjectId | null | undefined>) {
  const pending = ids.filter((id): id is Types.ObjectId => Boolean(id));
  if (pending.length === 0 || process.env.JOB_DISPATCH === "manual") return;
  const run = async () => {
    for (const id of pending) {
      try {
        await processOutboxItem(id);
      } catch (err) {
        logger.error("outbox.dispatch_failed", { error: err });
      }
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
