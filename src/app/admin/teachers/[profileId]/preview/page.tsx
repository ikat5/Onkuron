import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { TeacherProfileView } from "@/components/teacher-profile-view";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { listPublishedCourses } from "@/services/courses";
import { getTeacherProfile, toPublicProfile } from "@/services/teacher-profile";

export const metadata: Metadata = { title: "Teacher preview", robots: { index: false } };

/** Admin-only preview of a saved profile, published or not. */
export default async function TeacherPreviewPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  await requireUser(`/admin/teachers/${profileId}/preview`, "teacher");
  await connectDB();
  const teacher = await getTeacherProfile(profileId).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  const courses = teacher.courseIds.length ? await listPublishedCourses({ onlyIds: teacher.courseIds }) : [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sun-100 bg-sun-50 px-4 py-3 text-sm text-sun-700">
        <Icon name="eye" /> Preview of {teacher.displayName} — {teacher.published ? "public." : "not public yet."}
        <Link href={`/admin/teachers/${teacher.id}`} className="ml-auto font-semibold underline">
          Back to editor
        </Link>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas">
        <TeacherProfileView profile={toPublicProfile(teacher)} courses={courses} />
      </div>
    </div>
  );
}
