import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { featureStatus } from "@/lib/env";
import { courseOptions } from "../load";
import { TeacherEditor } from "../teacher-editor";

export const metadata: Metadata = { title: "Add teacher" };

export default async function NewTeacherPage() {
  await requireUser("/admin/teachers/new", "teacher");
  await connectDB();
  return (
    <>
      <Link href="/admin/teachers" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All teachers
      </Link>
      <PageHeader title="Add teacher" subtitle="Create a public profile. You can upload a photo right after saving." />
      <TeacherEditor initial={null} courses={await courseOptions()} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}
