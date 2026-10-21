import "server-only";
import { Types } from "mongoose";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { connectDB } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import type { CategoryInput } from "@/lib/validation";
import { Category, type ICategory } from "@/models/Category";
import { Course } from "@/models/Course";
import { queueAssetDeletion } from "./assets";
import { slugify } from "./courses";
import { seedOnce } from "./settings";

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  label: string;
  icon: string;
  imageUrl?: string;
  order: number;
  published: boolean;
  /** Published courses filed under this category. */
  courseCount: number;
}

/** What the public site needs; admin-only fields (order, publish state) stay out. */
export type PublicCategory = Omit<CategoryDTO, "id" | "order" | "published">;

/** The starter category (HSC ICT), inserted once into an empty database; the admin adds the rest. */
export function ensureDefaultCategories() {
  return seedOnce("categories", () =>
    Category.insertMany(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i, published: true })),
      { ordered: false },
    ).catch((err) => {
      // A concurrent first request already inserted them.
      if ((err as { code?: number }).code !== 11000) throw err;
    }),
  );
}

async function publishedCounts(): Promise<Map<string, number>> {
  const rows = await Course.aggregate<{ _id: string | null; n: number }>([{ $match: { published: true } }, { $group: { _id: "$category", n: { $sum: 1 } } }]);
  return new Map(rows.filter((r) => r._id).map((r) => [r._id as string, r.n]));
}

function toDTO(c: ICategory, counts: Map<string, number>): CategoryDTO {
  return {
    id: String(c._id),
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    label: c.label ?? "",
    icon: c.icon,
    imageUrl: c.image?.url || undefined,
    order: c.order,
    published: c.published,
    courseCount: counts.get(c.slug) ?? 0,
  };
}

/**
 * Categories in homepage order. A slug is listed once even if the database
 * holds copies of it (an earlier seeding bug created some before the unique
 * index existed); `all` lists every row, for the admin list.
 */
export async function listCategories(opts: { publishedOnly?: boolean; all?: boolean } = {}): Promise<CategoryDTO[]> {
  await ensureDefaultCategories();
  const [rows, counts] = await Promise.all([
    Category.find(opts.publishedOnly ? { published: true } : {})
      .sort({ order: 1, createdAt: 1 })
      .lean(),
    publishedCounts(),
  ]);
  const seen = new Set<string>();
  const unique = opts.all ? rows : rows.filter((c) => !seen.has(c.slug) && seen.add(c.slug));
  return unique.map((c) => toDTO(c, counts));
}

/** Published categories for public pages. Never throws (public pages must render while the database is down). */
export async function listPublicCategories(): Promise<PublicCategory[]> {
  try {
    await connectDB();
    return (await listCategories({ publishedOnly: true })).map((c) => ({ slug: c.slug, name: c.name, description: c.description, label: c.label, icon: c.icon, imageUrl: c.imageUrl, courseCount: c.courseCount }));
  } catch {
    return [];
  }
}

/** Published category by slug, for the catalogue filter. */
export async function getPublishedCategory(slug: string | undefined) {
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  await ensureDefaultCategories();
  return Category.findOne({ slug, published: true }).select("slug name icon description").lean();
}

/** slug → name and icon of every category (published or not), for course cards and pages. */
export async function categoryLookup(): Promise<Map<string, { name: string; icon: string; published: boolean }>> {
  await ensureDefaultCategories();
  const rows = await Category.find().select("slug name icon published").lean();
  return new Map(rows.map((c) => [c.slug, { name: c.name, icon: c.icon, published: c.published }]));
}

/** Used by the course service: a course may only be filed under an existing category. */
export async function assertCategoryExists(slug: string) {
  await ensureDefaultCategories();
  if (!(await Category.exists({ slug }))) throw badRequest("Please check the highlighted fields", { fields: { category: ["Choose one of the categories in the list"] } });
}

function assertId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound("Category not found");
}

export async function getCategory(id: string) {
  assertId(id);
  await ensureDefaultCategories();
  const c = await Category.findById(id).lean();
  if (!c) throw notFound("Category not found");
  const courseIds = (await Course.find({ category: c.slug }).select("_id").lean()).map((x) => String(x._id));
  return { ...toDTO(c, await publishedCounts()), courseIds };
}

/** Files exactly `courseIds` under `slug`: listed courses join it, others in it become uncategorised. */
async function assignCourses(slug: string, courseIds: string[]) {
  await Course.updateMany({ category: slug, _id: { $nin: courseIds } }, { $unset: { category: 1 } });
  if (courseIds.length) await Course.updateMany({ _id: { $in: courseIds } }, { $set: { category: slug } });
}

function duplicate(err: unknown) {
  if ((err as { code?: number }).code === 11000) return badRequest("Please check the highlighted fields", { fields: { name: ["A category with this name already exists"] } });
  return err;
}

export async function createCategory(teacher: SessionUser, input: CategoryInput, ip: string) {
  await ensureDefaultCategories();
  // The URL (?category=…) is generated from the name once and never changes, so shared links keep working.
  const slug = slugify(input.name, "category");
  const last = await Category.findOne().sort({ order: -1 }).select("order").lean();
  let created;
  try {
    created = await Category.create({
      slug,
      name: input.name,
      description: input.description,
      label: input.label || undefined,
      icon: input.icon,
      published: input.published,
      order: (last?.order ?? -1) + 1,
    });
  } catch (err) {
    throw duplicate(err);
  }
  if (input.courseIds) await assignCourses(slug, input.courseIds);
  await audit({ action: "category.created", actor: teacher, targetType: "category", targetId: String(created._id), ip, metadata: { slug } });
  return getCategory(String(created._id));
}

/** The slug stays as created (renaming keeps the category's URL and its courses). */
export async function updateCategory(teacher: SessionUser, id: string, input: CategoryInput, ip: string) {
  assertId(id);
  const before = await Category.findById(id).select("slug").lean();
  if (!before) throw notFound("Category not found");
  const set = { name: input.name, description: input.description, icon: input.icon, published: input.published };
  await Category.updateOne({ _id: id }, input.label ? { $set: { ...set, label: input.label } } : { $set: set, $unset: { label: 1 } }, { runValidators: true });
  if (input.courseIds) await assignCourses(before.slug, input.courseIds);
  await audit({ action: "category.updated", actor: teacher, targetType: "category", targetId: id, ip, metadata: { slug: before.slug, published: input.published } });
  return getCategory(id);
}

/** Refuses while courses are still filed under the category, so no course points at a deleted one. */
export async function deleteCategory(teacher: SessionUser, id: string, ip: string) {
  assertId(id);
  const c = await Category.findById(id).select("slug image").lean();
  if (!c) throw notFound("Category not found");
  await Category.deleteOne({ _id: id });
  // Its courses stay as they are, just without a category (unless another category still uses the slug).
  const uncategorized = (await Category.exists({ slug: c.slug })) ? 0 : (await Course.updateMany({ category: c.slug }, { $unset: { category: 1 } })).modifiedCount;
  if (c.image) await queueAssetDeletion(c.image, "category_deleted");
  await audit({ action: "category.deleted", actor: teacher, targetType: "category", targetId: id, ip, metadata: { slug: c.slug, uncategorized } });
  return { uncategorized };
}

export async function reorderCategories(teacher: SessionUser, ids: string[], ip: string) {
  const all = await Category.find().select("_id").lean();
  if (all.length !== ids.length || new Set(ids).size !== ids.length || !all.every((c) => ids.includes(String(c._id)))) {
    throw badRequest("The list of categories changed. Reload the page and try again.");
  }
  await Category.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  await audit({ action: "category.reordered", actor: teacher, ip });
  return listCategories({ all: true });
}

export async function removeCategoryImage(teacher: SessionUser, id: string, ip: string) {
  assertId(id);
  const before = await Category.findByIdAndUpdate(id, { $unset: { image: 1 } }, { returnDocument: "before" }).lean();
  if (!before) throw notFound("Category not found");
  if (before.image) await queueAssetDeletion(before.image, "category_image_removed");
  await audit({ action: "category.image_removed", actor: teacher, targetType: "category", targetId: id, ip });
}
