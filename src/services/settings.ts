import "server-only";
import { audit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/current";
import { Setting } from "@/models/Setting";
import type { z } from "zod";
import type { IntroInput, settingsSchema } from "@/lib/validation";
import { queueAssetDeletion } from "./assets";

export async function getSettings() {
  const s = await Setting.findOne({ key: "platform" }).lean();
  return {
    paymentNumbers: { bkash: s?.paymentNumbers?.bkash ?? "", nagad: s?.paymentNumbers?.nagad ?? "", rocket: s?.paymentNumbers?.rocket ?? "" },
    paymentInstructions: s?.paymentInstructions ?? "",
    supportEmail: s?.supportEmail ?? "",
    supportPhone: s?.supportPhone ?? "",
  };
}

export async function updateSettings(teacher: SessionUser, input: z.infer<typeof settingsSchema>, ip: string) {
  await Setting.updateOne(
    { key: "platform" },
    {
      $set: {
        "paymentNumbers.bkash": input.paymentNumbers.bkash || undefined,
        "paymentNumbers.nagad": input.paymentNumbers.nagad || undefined,
        "paymentNumbers.rocket": input.paymentNumbers.rocket || undefined,
        paymentInstructions: input.paymentInstructions,
        supportEmail: input.supportEmail || undefined,
        supportPhone: input.supportPhone || undefined,
      },
    },
    { upsert: true },
  );
  await audit({ action: "settings.updated", actor: teacher, ip });
  return getSettings();
}

export interface PlatformIntro {
  youtubeVideoId?: string;
  /** Uploaded video file (Cloudinary). The hero plays it instead of a YouTube video. */
  videoUrl?: string;
  title: string;
  text: string;
  /** Homepage promotional video section is shown. */
  enabled: boolean;
  /** Uploaded poster image (falls back to YouTube's own thumbnail). */
  thumbnailUrl?: string;
}

export const DEFAULT_INTRO = {
  title: "How Onkur works",
  text: "Onkur is an online classroom for HSC ICT and modern web development. Choose a course, enroll with bKash, Nagad or Rocket, and once a teacher verifies your payment you get structured video lessons, downloadable notes and direct help from your teacher — all in one place.",
  enabled: true,
};

/** Single source of truth for the promotional video (homepage hero and admin overview). */
export async function getIntro(): Promise<PlatformIntro> {
  const s = await Setting.findOne({ key: "platform" }).select("intro").lean();
  return {
    youtubeVideoId: s?.intro?.youtubeVideoId || undefined,
    videoUrl: s?.intro?.video?.url || undefined,
    title: s?.intro?.title || DEFAULT_INTRO.title,
    text: s?.intro?.text || DEFAULT_INTRO.text,
    enabled: s?.intro?.enabled ?? true,
    thumbnailUrl: s?.intro?.thumbnail?.url || undefined,
  };
}

/** Same as getIntro, but never throws (public pages must render while the database is down). */
export async function getIntroSafe(): Promise<PlatformIntro> {
  try {
    await connectDB();
    return await getIntro();
  } catch {
    return { ...DEFAULT_INTRO };
  }
}

/**
 * Runs `insert` the first time starter content of this kind is needed, then
 * remembers it, so content the admin later deletes is never re-created.
 * The flag is claimed atomically before inserting: of several concurrent
 * first requests, exactly one inserts (the others see the flag already set).
 */
export async function seedOnce(kind: "categories" | "topics", insert: () => Promise<unknown>) {
  const flag = `seeded.${kind}`;
  if (await Setting.exists({ key: "platform", [flag]: true })) return;
  try {
    const res = await Setting.updateOne({ key: "platform", [flag]: { $ne: true } }, { $set: { [flag]: true } }, { upsert: true });
    if (res.modifiedCount + res.upsertedCount === 0) return;
  } catch (err) {
    // The upsert collided with a settings row whose flag another request already set.
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }
  try {
    await insert();
  } catch (err) {
    await Setting.updateOne({ key: "platform" }, { $set: { [flag]: false } });
    throw err;
  }
}

/** URL of the teacher panel group photo, if uploaded. Never throws (public pages must render). */
export async function getTeamPhotoUrl(): Promise<string | undefined> {
  try {
    const s = await Setting.findOne({ key: "platform" }).select("teamPhoto").lean();
    return s?.teamPhoto?.url || undefined;
  } catch {
    return undefined;
  }
}

export async function removeTeamPhoto(teacher: SessionUser, ip: string) {
  const before = await Setting.findOneAndUpdate({ key: "platform" }, { $unset: { teamPhoto: 1 } }, { returnDocument: "before" }).lean();
  if (before?.teamPhoto) await queueAssetDeletion(before.teamPhoto, "team_photo_removed");
  await audit({ action: "settings.team_photo_removed", actor: teacher, ip });
}

/** Uploading goes through /api/teacher/uploads (kind "promo_video"); this removes the video (uploaded file or YouTube link). */
export async function removePromoVideo(teacher: SessionUser, ip: string) {
  const before = await Setting.findOneAndUpdate({ key: "platform" }, { $unset: { "intro.video": 1, "intro.youtubeVideoId": 1 } }, { returnDocument: "before" }).lean();
  if (before?.intro?.video) await queueAssetDeletion(before.intro.video, "promo_video_removed");
  await audit({ action: "settings.promo_video_removed", actor: teacher, ip });
  return getIntro();
}

/** Uploading goes through /api/teacher/uploads (kind "promo_thumbnail"); this removes the poster image. */
export async function removePromoThumbnail(teacher: SessionUser, ip: string) {
  const before = await Setting.findOneAndUpdate({ key: "platform" }, { $unset: { "intro.thumbnail": 1 } }, { returnDocument: "before" }).lean();
  if (before?.intro?.thumbnail) await queueAssetDeletion(before.intro.thumbnail, "promo_thumbnail_removed");
  await audit({ action: "settings.promo_thumbnail_removed", actor: teacher, ip });
  return getIntro();
}

/** Saves the hero text and YouTube link. A YouTube link replaces an uploaded video file (which is deleted). */
export async function updateIntro(teacher: SessionUser, input: IntroInput, ip: string) {
  const fields = { "intro.title": input.title, "intro.text": input.text, "intro.enabled": input.enabled };
  const before = await Setting.findOneAndUpdate(
    { key: "platform" },
    input.youtubeVideoId ? { $set: { ...fields, "intro.youtubeVideoId": input.youtubeVideoId }, $unset: { "intro.video": 1 } } : { $set: fields, $unset: { "intro.youtubeVideoId": 1 } },
    { upsert: true, returnDocument: "before" },
  ).lean();
  if (input.youtubeVideoId && before?.intro?.video) await queueAssetDeletion(before.intro.video, "promo_video_replaced");
  await audit({ action: "settings.intro_updated", actor: teacher, ip, metadata: { youtubeVideoId: input.youtubeVideoId } });
  return getIntro();
}
