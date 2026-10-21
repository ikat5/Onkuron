import type { Metadata } from "next";
import Link from "next/link";
import { CourseForm } from "@/components/teacher/course-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { listCategories } from "@/services/categories";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireUser("/admin/courses/new", "teacher");
  await connectDB();
  const categories = await listCategories();
  return (
    <>
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All courses
      </Link>
      <PageHeader title="New course" subtitle="Start with the basics. You'll add the thumbnail and lessons on the next screen." />
      <div className="max-w-3xl">
        <CourseForm categories={categories} />
      </div>
    </>
  );
}
