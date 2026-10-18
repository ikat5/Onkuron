import "server-only";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import { Setting } from "@/models/Setting";
import type { z } from "zod";
import type { IntroInput, settingsSchema } from "@/lib/validation";

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
  title: string;
  text: string;
}

export const DEFAULT_INTRO = {
  title: "How Onkur works",
  text: "Onkur is an online classroom for HSC ICT and modern web development. Choose a course, enroll with bKash, Nagad or Rocket, and once a teacher verifies your payment you get structured video lessons, downloadable notes and direct help from your teacher — all in one place.",
};

/** Single source of truth for the platform introduction (homepage and admin overview). */
export async function getIntro(): Promise<PlatformIntro> {
  const s = await Setting.findOne({ key: "platform" }).select("intro").lean();
  return {
    youtubeVideoId: s?.intro?.youtubeVideoId || undefined,
    title: s?.intro?.title || DEFAULT_INTRO.title,
    text: s?.intro?.text || DEFAULT_INTRO.text,
  };
}

/** Same as getIntro, but never throws (public pages must render while the database is down). */
export async function getIntroSafe(): Promise<PlatformIntro> {
  try {
    return await getIntro();
  } catch {
    return { ...DEFAULT_INTRO };
  }
}

export async function updateIntro(teacher: SessionUser, input: IntroInput, ip: string) {
  await Setting.updateOne(
    { key: "platform" },
    input.youtubeVideoId
      ? { $set: { "intro.youtubeVideoId": input.youtubeVideoId, "intro.title": input.title, "intro.text": input.text } }
      : { $set: { "intro.title": input.title, "intro.text": input.text }, $unset: { "intro.youtubeVideoId": 1 } },
    { upsert: true },
  );
  await audit({ action: "settings.intro_updated", actor: teacher, ip, metadata: { youtubeVideoId: input.youtubeVideoId } });
  return getIntro();
}
