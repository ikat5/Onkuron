import { handler, json } from "@/lib/api";
import { removeCategoryImage } from "@/services/categories";

/** Uploading goes through /api/teacher/uploads (kind "category_image"); this removes the image. */
export const DELETE = handler<undefined, { categoryId: string }>({ auth: "teacher" }, async ({ user, params, ip }) => {
  await removeCategoryImage(user!, params.categoryId, ip);
  return json({ ok: true });
});
