import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Types } from "mongoose";
import { CourseCard } from "@/components/course-card";
import { Icon, type IconName } from "@/components/icons";
import { QuoteRotator, TechExplainers } from "@/components/learn/tech-explainers";
import { TeacherCard } from "@/components/teacher-card";
import { Container, formatDate } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { Lesson } from "@/models/Lesson";
import { LessonProgress } from "@/models/LessonProgress";
import { listPublishedCourses } from "@/services/courses";
import { listPublicTeacherProfiles } from "@/services/teacher-profile";

export const metadata: Metadata = { title: "My learning", robots: { index: false } };

interface CourseProgress {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnailUrl?: string;
  total: number;
  done: number;
  pct: number;
  /** Lesson to open next: the last one the student was watching (if unfinished), else the first unfinished one. */
  next?: { id: string; title: string; number: number };
  lastActivity?: Date;
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard", "student");
  await connectDB();
  const studentId = new Types.ObjectId(user.id);

  const enrollments = await Enrollment.find({ studentId }).sort({ createdAt: -1 }).select("courseId status active decisionReason createdAt").lean();
  const approvedIds = [...new Set(enrollments.filter((e) => e.status === "approved").map((e) => String(e.courseId)))].map((id) => new Types.ObjectId(id));
  const activeIds = enrollments.filter((e) => e.active).map((e) => e.courseId);

  const [courses, lessons, progress, teachers, discover, availableCount] = await Promise.all([
    Course.find({ _id: { $in: enrollments.map((e) => e.courseId) } }).select("title slug summary thumbnail").lean(),
    Lesson.find({ courseId: { $in: approvedIds } }).sort({ order: 1, createdAt: 1 }).select("_id courseId title").lean(),
    LessonProgress.find({ studentId, courseId: { $in: approvedIds } }).select("lessonId completed updatedAt").lean(),
    listPublicTeacherProfiles(),
    listPublishedCourses({ excludeIds: activeIds, limit: 3 }),
    Course.countDocuments({ published: true, _id: { $nin: activeIds } }),
  ]);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const progressByLesson = new Map(progress.map((p) => [String(p.lessonId), p]));

  // Progress is computed against the lessons that exist now, so deleted lessons never skew it.
  const mine: CourseProgress[] = approvedIds.flatMap((cid) => {
    const c = courseById.get(String(cid));
    if (!c) return [];
    const ls = lessons.filter((l) => String(l.courseId) === String(cid));
    const done = ls.filter((l) => progressByLesson.get(String(l._id))?.completed).length;
    const touched = ls
      .map((l, i) => ({ l, i, p: progressByLesson.get(String(l._id)) }))
      .filter((x) => x.p)
      .sort((a, b) => b.p!.updatedAt.getTime() - a.p!.updatedAt.getTime());
    const last = touched[0];
    const firstOpenIndex = ls.findIndex((l) => !progressByLesson.get(String(l._id))?.completed);
    const nextIdx = last && !last.p!.completed ? last.i : firstOpenIndex;
    const next = nextIdx >= 0 ? { id: String(ls[nextIdx]._id), title: ls[nextIdx].title, number: nextIdx + 1 } : undefined;
    return [
      {
        id: String(c._id),
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        thumbnailUrl: c.thumbnail?.url,
        total: ls.length,
        done,
        pct: ls.length ? Math.round((done / ls.length) * 100) : 0,
        next,
        lastActivity: last?.p!.updatedAt,
      },
    ];
  });

  const inProgress = mine.filter((c) => c.next && c.total > 0).sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));
  const continueCourse = inProgress[0];
  const completedCourses = mine.filter((c) => c.total > 0 && c.done === c.total).length;
  const lessonsDone = mine.reduce((n, c) => n + c.done, 0);
  const lessonsTotal = mine.reduce((n, c) => n + c.total, 0);
  const overallPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;

  // Requests that still need attention: pending, or rejected without a newer request for the same course.
  const seen = new Set<string>();
  const needsAttention = enrollments.filter((e) => {
    const k = String(e.courseId);
    if (seen.has(k)) return false;
    seen.add(k);
    return e.status === "pending" || e.status === "rejected";
  });

  const stats: Array<{ label: string; value: string; icon: IconName; tint: string; href?: string }> = [
    { label: "My courses", value: String(mine.length), icon: "book", tint: "bg-brand-50 text-brand-700", href: "#my-courses" },
    { label: "In progress", value: String(inProgress.length), icon: "play", tint: "bg-sun-50 text-sun-700", href: continueCourse ? "#continue" : undefined },
    { label: "Completed courses", value: String(completedCourses), icon: "trophy", tint: "bg-leaf-50 text-leaf-700" },
    { label: "Available courses", value: String(availableCount), icon: "grid", tint: "bg-brand-50 text-brand-700", href: "/courses" },
  ];

  return (
    <>
      {/* Welcome */}
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.5),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(49,148,71,0.25),transparent_50%)]" />
        <Container className="relative flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-sun-400">My learning</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Hello, {user.name.split(" ")[0]} 👋</h1>
            <p className="mt-2 max-w-xl text-brand-100/85">Every lesson brings you one step closer to your goals.</p>
          </div>
          {lessonsTotal > 0 && (
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 md:w-80">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">Learning progress</span>
                <span className="font-display text-2xl font-extrabold text-leaf-400">{overallPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
                <div className="h-full rounded-full bg-gradient-to-r from-leaf-400 to-sun-400" style={{ width: `${overallPct}%`, animation: "grow 1.2s var(--ease-out-soft) both" }} />
              </div>
              <p className="mt-2 text-xs text-brand-100/70">
                {lessonsDone} of {lessonsTotal} lessons completed across your courses
              </p>
            </div>
          )}
        </Container>
      </section>

      <Container className="space-y-12 py-10">
        {/* Overview */}
        <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => {
            const inner = (
              <>
                <span className={`flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${s.tint}`}>
                  <Icon name={s.icon} className="size-5" />
                </span>
                <span className="mt-3 block font-display text-3xl font-extrabold text-ink">{s.value}</span>
                <span className="text-sm text-muted">{s.label}</span>
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="card lift group p-5 hover:border-brand-200">
                {inner}
              </Link>
            ) : (
              <div key={s.label} className="card group p-5">
                {inner}
              </div>
            );
          })}
        </section>

        {/* Requests that need attention (never shown for approved courses) */}
        {needsAttention.length > 0 && (
          <section aria-labelledby="requests-title" className="space-y-3">
            <h2 id="requests-title" className="text-lg font-extrabold text-ink">
              Enrollment requests
            </h2>
            {needsAttention.map((e) => {
              const c = courseById.get(String(e.courseId));
              if (!c) return null;
              return e.status === "pending" ? (
                <div key={String(e._id)} className="flex flex-col gap-2 rounded-xl border border-sun-100 bg-sun-50 p-4 sm:flex-row sm:items-center">
                  <Icon name="clock" className="size-5 text-sun-700" />
                  <p className="flex-1 text-sm text-ink">
                    <strong>{c.title}</strong> — your enrollment request is being reviewed. We&apos;ll email you when the course is unlocked.
                  </p>
                </div>
              ) : (
                <div key={String(e._id)} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                  <Icon name="alert" className="size-5 text-red-700" />
                  <p className="flex-1 text-sm text-ink">
                    <strong>{c.title}</strong> — your request wasn&apos;t approved{e.decisionReason ? `: ${e.decisionReason}` : "."}
                  </p>
                  <Link href={`/courses/${c.slug}/enroll`} className="btn-outline shrink-0 px-3 py-1.5 text-xs">
                    Submit a new request
                  </Link>
                </div>
              );
            })}
          </section>
        )}

        {/* Continue learning */}
        {continueCourse?.next && (
          <section id="continue" aria-labelledby="continue-title" className="scroll-mt-24">
            <h2 id="continue-title" className="mb-4 text-lg font-extrabold text-ink">
              Continue learning
            </h2>
            <Link href={`/learn/${continueCourse.slug}/${continueCourse.next.id}`} className="card lift group grid overflow-hidden hover:border-brand-200 md:grid-cols-[320px_1fr]">
              <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-brand-700 to-night-800 md:aspect-auto">
                {continueCourse.thumbnailUrl && <Image src={continueCourse.thumbnailUrl} alt="" fill sizes="320px" className="object-cover transition duration-500 group-hover:scale-105" />}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-sun-500 text-ink shadow-xl transition group-hover:scale-110">
                    <Icon name="play" className="ml-1 size-6" />
                  </span>
                </span>
              </div>
              <div className="flex flex-col justify-center p-6">
                <p className="text-xs font-bold tracking-wide text-leaf-700 uppercase">{continueCourse.title}</p>
                <p className="mt-1 text-xl font-extrabold text-ink group-hover:text-brand-700">
                  Lesson {continueCourse.next.number}: {continueCourse.next.title}
                </p>
                {continueCourse.lastActivity && <p className="mt-1 text-xs text-muted">Last studied {formatDate(continueCourse.lastActivity)}</p>}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-leaf-50">
                  <div className="h-full rounded-full bg-leaf-600" style={{ width: `${continueCourse.pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {continueCourse.done}/{continueCourse.total} lessons · {continueCourse.pct}%
                </p>
                <span className="btn-leaf mt-4 w-fit">
                  Continue learning <Icon name="right" />
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* My courses */}
        <section id="my-courses" aria-labelledby="my-courses-title" className="scroll-mt-24">
          <h2 id="my-courses-title" className="mb-4 text-lg font-extrabold text-ink">
            My courses
          </h2>
          {mine.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
                <Icon name="sprout" className="size-7" />
              </span>
              <p className="mt-4 text-lg font-bold text-ink">No courses yet</p>
              <p className="mt-1 max-w-md text-sm text-muted">When a teacher verifies your enrollment, the course appears here, ready to start.</p>
              <Link href="/courses" className="btn-primary mt-5">
                Browse courses
              </Link>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link href={c.next ? `/learn/${c.slug}/${c.next.id}` : `/learn/${c.slug}`} className="card lift group flex h-full flex-col overflow-hidden hover:border-brand-200">
                    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-brand-700 to-night-800">
                      {c.thumbnailUrl ? (
                        <Image src={c.thumbnailUrl} alt="" fill sizes="(min-width: 1024px) 360px, 50vw" className="object-cover transition duration-500 ease-out-soft group-hover:scale-105" />
                      ) : (
                        <span className="flex h-full items-center justify-center p-4 text-center font-display text-lg font-bold text-white/90">{c.title}</span>
                      )}
                      {c.total > 0 && c.done === c.total && (
                        <span className="absolute top-3 right-3 badge gap-1 bg-leaf-600 text-white">
                          <Icon name="check" className="size-3" /> Completed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-lg font-bold text-ink group-hover:text-brand-700">{c.title}</h3>
                      {c.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>}
                      <div className="mt-auto pt-5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">
                            {c.done}/{c.total} lessons
                          </span>
                          <span className="font-bold text-leaf-700">{c.pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-leaf-50" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
                          <div className="h-full rounded-full bg-leaf-600 transition-all duration-700" style={{ width: `${c.pct}%`, animation: "grow 1s var(--ease-out-soft) both" }} />
                        </div>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
                          {c.total === 0 ? "Open course" : c.done === 0 ? "Start learning" : c.done === c.total ? "Review lessons" : "Continue learning"}
                          <Icon name="right" className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Animated "how tech works" explainers */}
        <TechExplainers />

        {/* Teachers */}
        {teachers.length > 0 && (
          <section aria-labelledby="teachers-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="teachers-title" className="text-lg font-extrabold text-ink">
                Your teachers
              </h2>
              <Link href="/teachers" className="text-sm font-semibold text-brand-600 hover:underline">
                Meet all teachers
              </Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {teachers.map((t) => (
                <TeacherCard key={t.slug} profile={t} />
              ))}
            </div>
          </section>
        )}

        {/* Discover more */}
        {discover.length > 0 && (
          <section aria-labelledby="discover-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="discover-title" className="text-lg font-extrabold text-ink">
                Discover more courses
              </h2>
              <Link href="/courses" className="text-sm font-semibold text-brand-600 hover:underline">
                Full catalogue
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {discover.map((c) => (
                <CourseCard key={String(c._id)} course={c} />
              ))}
            </div>
          </section>
        )}

        {/* Motivation */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <QuoteRotator />
          <section aria-labelledby="habits-title" className="card p-6 sm:p-8">
            <p className="eyebrow text-leaf-600">Small steps, every day</p>
            <h2 id="habits-title" className="mt-2 text-xl font-extrabold text-ink">
              Habits that turn lessons into skills
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-ink">
              {[
                ["clock", "Set a regular study time — even 20 minutes counts."],
                ["code", "Try every example yourself before moving on."],
                ["file", "Keep the lesson notes open while you practise."],
                ["chat", "Ask your teacher when something doesn't make sense."],
              ].map(([icon, text]) => (
                <li key={text} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                    <Icon name={icon as IconName} className="size-4" />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
          <Link href="/dashboard/messages" className="inline-flex items-center gap-2 font-semibold text-brand-700 hover:underline">
            <Icon name="chat" /> Message a teacher
          </Link>
          {enrollments.length > 0 && (
            <Link href="/dashboard/payments" className="inline-flex items-center gap-2 text-muted hover:text-brand-700">
              <Icon name="receipt" /> Payment history
            </Link>
          )}
        </div>
      </Container>
    </>
  );
}
