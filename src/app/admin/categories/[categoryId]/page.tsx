import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { featureStatus } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getCategory } from "@/services/categories";
import { CategoryEditor } from "../category-editor";
import { categoryCourseOptions } from "../load";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  await requireUser(`/admin/categories/${categoryId}`, "teacher");
  await connectDB();
  const category = await getCategory(categoryId).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  return (
    <>
      <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All categories
      </Link>
      <PageHeader title={category.name} subtitle={category.published ? "Published on the homepage and in the catalogue" : "Hidden — not visible to visitors"} />
      <CategoryEditor initial={category} courses={await categoryCourseOptions()} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}
