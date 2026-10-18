import "server-only";
import { getCloudinary } from "@/lib/cloudinary";
import { after } from "next/server";
import { logger } from "@/lib/logger";
import { AssetDeletion } from "@/models/AssetDeletion";
import { Course, type IAsset } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { TeacherProfile } from "@/models/TeacherProfile";

/**
 * Asset deletions are queued durably and executed only after the database no
 * longer references the asset. A failed Cloudinary call is retried later.
 */
export async function queueAssetDeletion(asset: Pick<IAsset, "publicId" | "resourceType" | "deliveryType">, reason: string) {
  await AssetDeletion.updateOne(
    { publicId: asset.publicId },
    {
      $setOnInsert: {
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        deliveryType: asset.deliveryType,
        reason,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    },
    { upsert: true },
  );
  if (process.env.JOB_DISPATCH === "manual") return;
  try {
    after(() => processAssetDeletions(5).catch((err) => logger.error("assets.cleanup_failed", { error: err })));
  } catch {
    // Outside a request (scripts/tests): the worker picks it up.
  }
}

async function stillReferenced(publicId: string) {
  return Boolean(
    (await Course.exists({ "thumbnail.publicId": publicId })) ||
      (await TeacherProfile.exists({ "photo.publicId": publicId })) ||
      (await Lesson.exists({ $or: [{ "video.publicId": publicId }, { "resources.asset.publicId": publicId }] })),
  );
}

export async function processAssetDeletions(limit = 20) {
  const results = { deleted: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const job = await AssetDeletion.findOneAndUpdate(
      {
        status: "pending",
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }],
      },
      { $set: { lockedUntil: new Date(now.getTime() + 120_000) }, $inc: { attempts: 1 } },
      { returnDocument: "after", sort: { nextAttemptAt: 1 } },
    );
    if (!job) break;
    if (await stillReferenced(job.publicId)) {
      await AssetDeletion.updateOne({ _id: job._id }, { $set: { status: "done", lastError: "still referenced; kept" } });
      results.skipped++;
      continue;
    }
    try {
      const res = await getCloudinary().uploader.destroy(job.publicId, {
        resource_type: job.resourceType,
        type: job.deliveryType,
        invalidate: true,
      });
      if (res.result !== "ok" && res.result !== "not found") throw new Error(`destroy returned ${res.result}`);
      await AssetDeletion.updateOne({ _id: job._id }, { $set: { status: "done" }, $unset: { lockedUntil: 1 } });
      results.deleted++;
    } catch (err) {
      const exhausted = job.attempts >= 8;
      await AssetDeletion.updateOne(
        { _id: job._id },
        {
          $set: {
            status: exhausted ? "failed" : "pending",
            lastError: err instanceof Error ? err.message.slice(0, 300) : "error",
            nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 60_000 * 2 ** job.attempts)),
          },
          $unset: { lockedUntil: 1 },
        },
      );
      results.failed++;
    }
  }
  return results;
}
