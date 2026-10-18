import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { featureStatus } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getTeacherProfile } from "@/services/teacher-profile";
import { courseOptions } from "../load";
import { TeacherEditor } from "../teacher-editor";

export const metadata: Metadata = { title: "Edit teacher" };

export default async function EditTeacherPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  await requireUser(`/admin/teachers/${profileId}`, "teacher");
  await connectDB();
  const teacher = await getTeacherProfile(profileId).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  return (
    <>
      <Link href="/admin/teachers" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All teachers
      </Link>
      <PageHeader title={teacher.displayName} subtitle={teacher.published ? "Published on the website" : "Draft — not visible to visitors"} />
      <TeacherEditor initial={teacher} courses={await courseOptions()} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}
