import { handler, json } from "@/lib/api";
import { removePromoVideo } from "@/services/settings";

/** Uploading goes through /api/teacher/uploads (kind "promo_video"); this removes the video (file or YouTube link). */
export const DELETE = handler({ auth: "teacher" }, async ({ user, ip }) => {
  return json({ intro: await removePromoVideo(user!, ip) });
});
