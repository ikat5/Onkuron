import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ContentList } from "@/components/teacher/content-list";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { listCategories } from "@/services/categories";

export const metadata: Metadata = { title: "Learning categories" };

export default async function CategoriesPage() {
  await requireUser("/admin/categories", "teacher");
  await connectDB();
  const categories = await listCategories({ all: true });
  const rows = categories.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: c.description || "No description yet",
    meta: `${c.courseCount} published course${c.courseCount === 1 ? "" : "s"}${c.label ? ` · Badge: ${c.label}` : ""} · /courses?category=${c.slug}`,
    imageUrl: c.imageUrl,
    icon: c.icon,
    published: c.published,
    publicHref: c.published ? `/courses?category=${c.slug}` : undefined,
    body: { name: c.name, description: c.description, label: c.label, icon: c.icon, published: c.published },
  }));
  return (
    <>
      <PageHeader
        title="Learning categories"
        subtitle="The “What would you like to learn?” cards on the homepage and the course catalogue filters, in this order."
        action={
          <Link href="/admin/categories/new" className="btn-leaf shrink-0 px-5 py-3 whitespace-nowrap">
            <Icon name="plus" className="size-5" /> Add category
          </Link>
        }
      />
      <ContentList key={rows.map((r) => `${r.id}:${r.published}`).join()} kind="categories" initial={rows} />
    </>
  );
}
