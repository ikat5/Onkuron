import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { featureStatus } from "@/lib/env";
import { CategoryEditor } from "../category-editor";
import { categoryCourseOptions } from "../load";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategoryPage() {
  await requireUser("/admin/categories/new", "teacher");
  await connectDB();
  return (
    <>
      <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All categories
      </Link>
      <PageHeader title="New category" subtitle="Create a learning path. You can upload a card image right after saving." />
      <CategoryEditor initial={null} courses={await categoryCourseOptions()} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}
