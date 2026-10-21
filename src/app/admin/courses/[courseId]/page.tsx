import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { CourseForm } from "@/components/teacher/course-form";
import { CurriculumBuilder } from "@/components/teacher/curriculum-builder";
import { ActionButton } from "@/components/teacher/action-button";
import { Icon } from "@/components/icons";
import { ThumbnailUploader } from "./thumbnail-uploader";
import { Alert, formatTaka, StatusBadge } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { featureStatus } from "@/lib/env";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { listCategories } from "@/services/categories";
import { listLessonsForTeacher } from "@/services/lessons";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireUser(`/admin/courses/${courseId}`, "teacher");
  if (!Types.ObjectId.isValid(courseId)) notFound();
  await connectDB();
  const course = await Course.findById(courseId).lean();
  if (!course) notFound();
  const [lessons, students, categories] = await Promise.all([listLessonsForTeacher(courseId), Enrollment.countDocuments({ courseId, status: "approved" }), listCategories()]);
  const canUpload = featureStatus().cloudinary.ok;

  return (
    <>
      <div className="mb-6">
        <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <Icon name="left" /> All courses
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-brand-700 sm:text-3xl">{course.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge status={course.published ? "published" : "draft"} />
              <span>{formatTaka(course.price)}</span>
              <span aria-hidden>·</span>
              <span>
                {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
              </span>
              <span aria-hidden>·</span>
              <span>
                {students} enrolled student{students === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/learn/${course.slug}`} className="btn-outline">
              <Icon name="eye" /> Preview as student
            </Link>
            {course.published && (
              <Link href={`/courses/${course.slug}`} className="btn-outline">
                <Icon name="external" /> Course page
              </Link>
            )}
          </div>
        </div>
        <nav aria-label="Course editor sections" className="mt-5 flex gap-1 border-b border-line text-sm font-medium">
          <a href="#details" className="border-b-2 border-brand-600 px-3 py-2 text-brand-700">
            Details
          </a>
          <a href="#curriculum" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">
            Curriculum
          </a>
        </nav>
      </div>

      {!canUpload && (
        <div className="mb-6">
          <Alert tone="warning" title="File uploads unavailable">
            Cloudinary credentials are missing or invalid, so thumbnails and resource files can&apos;t be uploaded yet. YouTube videos and links still work.
          </Alert>
        </div>
      )}

      <div id="details" className="grid scroll-mt-6 gap-6 xl:grid-cols-[1fr_320px]">
        <CourseForm
          categories={categories}
          initial={{
            id: courseId,
            title: course.title,
            summary: course.summary,
            description: course.description,
            price: course.price,
            category: course.category ?? "",
            published: course.published,
          }}
        />
        <aside className="space-y-6">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Thumbnail</h2>
              <p className="text-xs text-muted">16:9 JPG, PNG or WebP. Shown on course cards.</p>
            </div>
            <div className="space-y-3 p-5">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-brand-50 to-leaf-50">
                {course.thumbnail?.url ? (
                  <Image src={course.thumbnail.url} alt="Course thumbnail" fill sizes="320px" className="object-cover" />
                ) : (
                  <p className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted">
                    <Icon name="upload" className="size-6" />
                    No thumbnail yet
                  </p>
                )}
              </div>
              {canUpload && <ThumbnailUploader courseId={courseId} hasThumbnail={Boolean(course.thumbnail)} />}
            </div>
          </section>
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <Icon name="video" className="size-5 text-red-600" /> Video hosting
            </h2>
            <p className="text-muted">Lesson videos stream from YouTube; they are not stored on this platform.</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Upload to the platform&apos;s YouTube channel as <strong>Unlisted</strong>.</li>
              <li>Copy the link from YouTube&apos;s Share button.</li>
              <li>Paste it into the lesson editor.</li>
            </ol>
            <p className="rounded-lg bg-sun-50 p-2 text-xs text-sun-700">Unlisted videos are not private: anyone who has the link can watch them on YouTube.</p>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-red-700">Danger zone</h2>
            <ActionButton url={`/api/teacher/courses/${courseId}`} method="DELETE" label="Delete course" confirmLabel="Delete permanently" className="btn-danger w-full" redirectTo="/admin/courses" />
          </section>
        </aside>
      </div>

      <div className="mt-10">
        <CurriculumBuilder courseId={courseId} initialLessons={lessons} canUpload={canUpload} />
      </div>
    </>
  );
}
