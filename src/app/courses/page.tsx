import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { Container } from "@/components/ui";
import { categoryLabel, COURSE_CATEGORIES, isCategory } from "@/lib/categories";
import { connectDB } from "@/lib/db";
import { listPublishedCourses } from "@/services/courses";
import { getPublicTeacherProfile } from "@/services/teacher-profile";

type Props = { searchParams: Promise<{ category?: string; teacher?: string }> };

/** `?teacher=<slug>` narrows the catalogue to one published teacher's linked courses. */
async function teacherFilter(slug: string | undefined) {
  if (!slug || !/^[a-z0-9-]{1,80}$/i.test(slug)) return null;
  await connectDB();
  return getPublicTeacherProfile(slug).catch(() => null);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category, teacher: teacherSlug } = await searchParams;
  const teacher = await teacherFilter(teacherSlug);
  if (teacher) {
    return {
      title: `Courses by ${teacher.profile.displayName}`,
      description: `Online courses taught by ${teacher.profile.displayName} at Onkur.`,
      alternates: { canonical: `/teachers/${teacher.profile.slug}` },
    };
  }
  const label = isCategory(category) ? categoryLabel(category) : undefined;
  return {
    title: label ? `${label} courses` : "Courses — HSC ICT & Web Development",
    description: label
      ? `Online ${label} courses at Onkur with structured video lessons, notes and teacher support.`
      : "Browse Onkur's online courses in HSC and SSC ICT, physics, chemistry, math, biology and programming.",
    alternates: { canonical: label ? `/courses?category=${category}` : "/courses" },
  };
}

function queryString(params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return q ? `?${q}` : "";
}

export default async function CoursesPage({ searchParams }: Props) {
  const { category: raw, teacher: teacherSlug } = await searchParams;
  const category = isCategory(raw) ? raw : undefined;
  await connectDB();
  const teacher = await teacherFilter(teacherSlug);
  const courses = teacher ? (teacher.courseIds.length ? await listPublishedCourses({ category, onlyIds: teacher.courseIds }) : []) : await listPublishedCourses({ category });
  const label = categoryLabel(category);
  const teacherName = teacher?.profile.displayName;

  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.45),transparent_60%)]" />
        <Container className="relative py-14">
          <p className="eyebrow text-sun-400">Course catalogue</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{teacherName ? `Courses by ${teacherName}` : label ? `${label} courses` : "All courses"}</h1>
          <p className="mt-3 max-w-2xl text-lg text-brand-100/85">Pick a course, pay securely by mobile banking, and start learning once a teacher verifies your enrollment.</p>
        </Container>
      </section>
      <Container className="py-10">
        {teacher && (
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            Showing courses taught by
            <Link href={`/teachers/${teacher.profile.slug}`} className="font-semibold text-brand-700 hover:underline">
              {teacherName}
            </Link>
            <Link href={category ? `/courses?category=${category}` : "/courses"} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand-200">
              <Icon name="x" className="size-3" /> Clear
            </Link>
          </p>
        )}
        <nav aria-label="Filter by category" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: undefined, label: "All" }, ...COURSE_CATEGORIES].map((c) => {
            const active = c.id === category;
            return (
              <Link
                key={c.label}
                href={`/courses${queryString({ category: c.id, teacher: teacher?.profile.slug })}`}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:border-brand-200 hover:text-brand-700"}`}
              >
                {c.label}
              </Link>
            );
          })}
        </nav>
        {courses.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
              <Icon name="sprout" className="size-7" />
            </span>
            <p className="mt-4 text-lg font-bold text-ink">{teacherName ? `No published courses by ${teacherName} yet` : label ? `No ${label} courses yet` : "No courses yet"}</p>
            <p className="mt-1 max-w-md text-sm text-muted">New courses are being prepared. Please check back soon.</p>
            {(label || teacher) && (
              <Link href="/courses" className="btn-primary mt-5">
                See all courses
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted">
              {courses.length} course{courses.length === 1 ? "" : "s"}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c, i) => (
                <CourseCard key={String(c._id)} course={c} priority={i < 3} index={i} />
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  );
}
