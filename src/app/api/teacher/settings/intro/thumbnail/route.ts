import { handler, json } from "@/lib/api";
import { removePromoThumbnail } from "@/services/settings";

/** Uploading goes through /api/teacher/uploads (kind "promo_thumbnail"); this removes the poster image. */
export const DELETE = handler({ auth: "teacher" }, async ({ user, ip }) => {
  return json({ intro: await removePromoThumbnail(user!, ip) });
});
