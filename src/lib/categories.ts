import type { IconName } from "@/components/icons";

/**
 * Learning categories live in the database (Category model) and are managed
 * from /admin/categories. This file only holds what the browser also needs:
 * the icon choices offered in the admin form and the starter category (HSC
 * ICT) seeded once into an empty database.
 */

export const CATEGORY_ICONS = ["chip", "atom", "flask", "sigma", "leaf", "code", "rocket", "book", "layers", "server", "target", "cap", "sparkle", "gauge"] as const satisfies readonly IconName[];
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_CATEGORIES: Array<{ slug: string; name: string; description: string; icon: CategoryIcon }> = [
  { slug: "hsc-ict", name: "HSC ICT", description: "Computer fundamentals, number systems, networking, databases and the full HSC ICT syllabus.", icon: "chip" },
];

export function isCategoryIcon(icon: unknown): icon is CategoryIcon {
  return typeof icon === "string" && (CATEGORY_ICONS as readonly string[]).includes(icon);
}

/** Subject icon for a category (a generic book when none is set). */
export function categoryIcon(icon?: string | null): IconName {
  return isCategoryIcon(icon) ? icon : "book";
}
