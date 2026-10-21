import { handler, json } from "@/lib/api";
import { idOrderSchema } from "@/lib/validation";
import { reorderCategories } from "@/services/categories";

export const PUT = handler({ auth: "teacher", body: idOrderSchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, ip }) => {
  return json({ categories: await reorderCategories(user!, body.ids, ip) });
});
