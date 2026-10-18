import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { CourseHeader } from "@/components/learn/course-header";
import { Alert, Container } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { youtubeThumbnail } from "@/lib/youtube";
import type { LessonDTO, ResourceDTO } from "@/services/lessons";
import type { ProgressDTO } from "@/services/progress";
import { loadLearnerCourse } from "./load";

export const metadata: Metadata = { title: "Learn", robots: { index: false } };

const RESOURCE_ICON = { pdf: "file", slides: "slides", document: "file", link: "link" } as const;
const RESOURCE_TINT: Record<ResourceDTO["kind"], string> = {
  pdf: "text-red-700",
  slides: "text-sun-700",
  document: "text-brand-700",
  link: "text-leaf-700",
};

function StatusBadge({ p }: { p?: ProgressDTO }) {
  if (p?.completed) {
    return (
      <span className="badge gap-1 bg-leaf-600 text-white">
        <Icon name="check" className="size-3" /> Completed
      </span>
    );
  }
  if (p && p.percent > 0) return <span className="badge bg-sun-500 text-white">{p.percent}% watched</span>;
  return <span className="badge bg-white/90 text-ink">Not started</span>;
}

function LessonCard({ slug, lesson, index, progress, showStatus }: { slug: string; lesson: LessonDTO; index: number; progress?: ProgressDTO; showStatus: boolean }) {
  const shown = lesson.resources.slice(0, 3);
  const more = lesson.resources.length - shown.length;
  return (
    <li>
      <Link
        href={`/learn/${slug}/${lesson.id}`}
        className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg focus-visible:-translate-y-0.5"
      >
        <div className="relative aspect-video bg-brand-900">
          {lesson.youtubeVideoId ? (
            <Image src={youtubeThumbnail(lesson.youtubeVideoId, "hqdefault")} alt="" fill unoptimized sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover opacity-90 transition group-hover:opacity-100" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 text-brand-100">
              <Icon name="video" className="size-10" />
            </div>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {(lesson.youtubeVideoId || lesson.legacyVideo) && (
            <span className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-lg transition group-hover:scale-110 group-hover:bg-sun-500 group-hover:text-white">
              <Icon name="play" className="ml-0.5 size-5" />
            </span>
          )}
          <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">Lesson {index + 1}</span>
          {showStatus && (
            <span className="absolute top-3 right-3">
              <StatusBadge p={progress} />
            </span>
          )}
          {showStatus && progress && !progress.completed && progress.percent > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
              <span className="block h-full bg-sun-500" style={{ width: `${progress.percent}%` }} />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h2 className="font-semibold text-ink group-hover:text-brand-700">{lesson.title}</h2>
          {lesson.description ? <p className="mt-1 line-clamp-3 text-sm text-muted">{lesson.description}</p> : <p className="mt-1 text-sm text-muted/70 italic">No description</p>}
          <div className="mt-auto pt-4">
            {lesson.resources.length > 0 ? (
              <ul className="space-y-1 border-t border-line pt-3 text-xs" aria-label="Lesson resources">
                {shown.map((r) => (
                  <li key={r.id} className="flex items-center gap-1.5 text-ink">
                    <Icon name={RESOURCE_ICON[r.kind]} className={`size-3.5 ${RESOURCE_TINT[r.kind]}`} />
                    <span className="truncate">{r.title}</span>
                  </li>
                ))}
                {more > 0 && <li className="text-muted">+{more} more</li>}
              </ul>
            ) : (
              <p className="border-t border-line pt-3 text-xs text-muted">No resources</p>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Course overview: one card per lesson. Opening a card goes to the lesson page. */
export default async function CourseOverviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const { slug } = await params;
  const { lesson: legacyLesson } = await searchParams;
  // Old links used ?lesson=<id>.
  if (legacyLesson && /^[a-f0-9]{24}$/i.test(legacyLesson)) redirect(`/learn/${slug}/${legacyLesson}`);

  const user = await requireUser(`/learn/${slug}`);
  await connectDB();
  const result = await loadLearnerCourse(user, slug);
  if (result === "forbidden") redirect(`/courses/${slug}`);
  if (result === "missing") notFound();
  const { course, lessons, progress } = result;

  const isStudent = user.role === "student";
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const completed = lessons.filter((l) => byLesson.get(l.id)?.completed).length;
  const nextUp = lessons.find((l) => !byLesson.get(l.id)?.completed);
  const started = progress.some((p) => p.completed || p.percent > 0);

  return (
    <>
      <CourseHeader
        title={course.title}
        backHref={isStudent ? "/dashboard" : `/admin/courses/${course.id}`}
        backLabel={isStudent ? "My learning" : "Back to course editor"}
        completed={completed}
        total={lessons.length}
        teacherPreview={!isStudent}
      />
      <Container className="py-6">
        {lessons.length === 0 ? (
          <Alert>Lessons will appear here soon.</Alert>
        ) : (
          <>
            {isStudent && nextUp && (
              <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-leaf-100 bg-leaf-50 p-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white">
                  <Icon name="play" className="ml-0.5 size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-leaf-700 uppercase">{started ? "Continue learning" : "Start here"}</p>
                  <p className="truncate font-semibold text-ink">
                    Lesson {lessons.indexOf(nextUp) + 1}: {nextUp.title}
                  </p>
                </div>
                <Link href={`/learn/${course.slug}/${nextUp.id}`} className="btn-leaf">
                  {started ? "Continue" : "Start lesson 1"} <Icon name="right" />
                </Link>
              </div>
            )}
            {isStudent && !nextUp && (
              <div className="mb-6">
                <Alert tone="success" title="Course complete 🎉">
                  You&apos;ve finished every lesson. You can rewatch any of them below.
                </Alert>
              </div>
            )}
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-ink">All lessons</h2>
              <p className="text-sm text-muted">{lessons.length} lessons</p>
            </div>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((l, i) => (
                <LessonCard key={l.id} slug={course.slug} lesson={l} index={i} progress={byLesson.get(l.id)} showStatus={isStudent} />
              ))}
            </ol>
          </>
        )}
      </Container>
    </>
  );
}
