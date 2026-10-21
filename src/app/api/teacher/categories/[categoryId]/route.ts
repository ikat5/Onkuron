import { handler, json } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { deleteCategory, getCategory, updateCategory } from "@/services/categories";

type P = { categoryId: string };

export const GET = handler<undefined, P>({ auth: "teacher" }, async ({ params }) => json({ category: await getCategory(params.categoryId) }));

export const PUT = handler<typeof categorySchema, P>({ auth: "teacher", body: categorySchema, maxBodyBytes: 32 * 1024 }, async ({ body, user, params, ip }) => {
  return json({ category: await updateCategory(user!, params.categoryId, body, ip) });
});

/** Refused (409) while courses are still filed under the category. */
export const DELETE = handler<undefined, P>({ auth: "teacher" }, async ({ user, params, ip }) => {
  return json(await deleteCategory(user!, params.categoryId, ip));
});
