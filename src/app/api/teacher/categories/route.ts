import { handler, json } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { createCategory, listCategories } from "@/services/categories";

/** Learning categories (published and drafts), in homepage order. */
export const GET = handler({ auth: "teacher" }, async () => json({ categories: await listCategories({ all: true }) }));

export const POST = handler({ auth: "teacher", body: categorySchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, ip }) => {
  return json({ category: await createCategory(user!, body, ip) }, { status: 201 });
});
