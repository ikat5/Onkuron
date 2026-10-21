import { handler, json } from "@/lib/api";
import { listPublicCategories } from "@/services/categories";

/** Published learning categories in homepage order, with their published course counts. */
export const GET = handler({ auth: "none" }, async () => json({ categories: await listPublicCategories() }));
