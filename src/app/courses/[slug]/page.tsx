import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { Icon } from "@/components/icons";
import { Alert, Container, formatTaka } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current";
import { getPublicCourse } from "@/services/courses";
import { listTeachersForCourse } from "@/services/teacher-profile";
import { TeacherAvatar } from "@/components/teacher-card";
import { Enrollment } from "@/models/Enrollment";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectDB();
  const data = await getPublicCourse(slug);
  if (!data) return { title: "Course not found", robots: { index: false } };
  const { course } = data;
  const description = (course.summary || course.description || `Learn ${course.title} online at Onkur.`).slice(0, 160);
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description, type: "website", url: `/courses/${course.slug}`, ...(course.thumbnail?.url ? { images: [{ url: course.thumbnail.url, alt: course.title }] } : {}) },
  };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  await connectDB();
  const data = await getPublicCourse(slug);
  if (!data) notFound();
  const { course, lessons, categoryName: category } = data;
  const [user, teachers] = await Promise.all([getCurrentUser(), listTeachersForCourse(course._id)]);

  const latest =
    user?.role === "student"
      ? await Enrollment.findOne({ studentId: new Types.ObjectId(user.id), courseId: course._id }).sort({ createdAt: -1 }).select("status decisionReason").lean()
      : null;

  let cta;
  if (user?.role === "teacher") {
    cta = (
      <Link href={`/admin/courses/${course._id}`} className="btn-primary w-full py-3">
        Manage this course
      </Link>
    );
  } else if (latest?.status === "approved") {
    // Owned course: a learning resource, not a payment record — no status badge.
    cta = (
      <Link href={`/learn/${course.slug}`} className="btn-leaf w-full py-3 text-base">
        Continue learning <Icon name="right" />
      </Link>
    );
  } else if (latest?.status === "pending") {
    cta = (
      <Alert tone="warning" title="Your enrollment is being reviewed">
        A teacher is checking your payment. We&apos;ll email you as soon as the course is unlocked.
      </Alert>
    );
  } else {
    cta = (
      <div className="space-y-3">
        {latest?.status === "rejected" && (
          <Alert tone="error" title="Your last request wasn't approved">
            {latest.decisionReason ?? "Please check your payment details."} You can submit a new request.
          </Alert>
        )}
        <Link href={user ? `/courses/${course.slug}/enroll` : `/login?next=${encodeURIComponent(`/courses/${course.slug}/enroll`)}`} className="btn-sun w-full py-3.5 text-base">
          Enroll now
        </Link>
        {!user && <p className="text-center text-xs text-muted">You&apos;ll sign in or create a free account first.</p>}
      </div>
    );
  }

  // Structured data with real values only (no ratings or invented fields).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.summary || course.description || course.title,
    provider: { "@type": "Organization", name: "Onkur (অঙ্কুরণ)", sameAs: process.env.APP_URL },
    offers: { "@type": "Offer", price: course.price, priceCurrency: "BDT", category: "Paid" },
    ...(course.thumbnail?.url ? { image: course.thumbnail.url } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.5),transparent_60%)]" />
        <Container className="relative py-12 lg:py-16">
          <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-brand-200 hover:text-white">
            <Icon name="left" /> All courses
          </Link>
          <div className="mt-4 max-w-3xl">
            {category && <span className="badge bg-white/10 text-sun-400 ring-1 ring-white/15">{category}</span>}
            <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">{course.title}</h1>
            {course.summary && <p className="mt-4 text-lg leading-relaxed text-brand-100/85">{course.summary}</p>}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100/85">
              <li className="flex items-center gap-2">
                <Icon name="video" className="size-4 text-leaf-400" /> {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </li>
              <li className="flex items-center gap-2">
                <Icon name="book" className="size-4 text-leaf-400" /> Notes &amp; resources
              </li>
              <li className="flex items-center gap-2">
                <Icon name="chat" className="size-4 text-leaf-400" /> Ask your teacher
              </li>
            </ul>
          </div>
        </Container>
      </section>

      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {course.description && (
              <section aria-labelledby="about-course" className="card p-6 sm:p-8">
                <h2 id="about-course" className="text-2xl font-extrabold text-ink">
                  About this course
                </h2>
                <div className="mt-4 leading-relaxed whitespace-pre-line text-ink">{course.description}</div>
              </section>
            )}

            {teachers.length > 0 && (
              <section aria-labelledby="course-teachers" className="mt-8">
                <h2 id="course-teachers" className="mb-4 text-2xl font-extrabold text-ink">
                  Your {teachers.length === 1 ? "teacher" : "teachers"}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {teachers.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/teachers/${t.slug}`} className="card lift group flex items-center gap-4 p-4 hover:border-brand-200">
                        <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
                          <TeacherAvatar profile={t} initialSize="text-2xl" className="transition duration-500 group-hover:scale-110" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-ink group-hover:text-brand-700">{t.displayName}</span>
                          {t.headline && <span className="block truncate text-sm text-muted">{t.headline}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="content-title" className="mt-8">
              <h2 id="content-title" className="mb-4 text-2xl font-extrabold text-ink">
                Course content
              </h2>
              <ol className="card divide-y divide-line overflow-hidden">
                {lessons.length === 0 && <li className="p-5 text-sm text-muted">Lessons will be added soon.</li>}
                {lessons.map((l, i) => (
                  <li key={String(l._id)} className="flex items-center gap-4 p-4 transition-colors hover:bg-canvas">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-ink">{l.title}</span>
                    <Icon name={latest?.status === "approved" ? "play" : "shield"} className="size-4 text-muted" title={latest?.status === "approved" ? "Available" : "Unlocks after enrollment"} />
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="lg:self-start">
            <div className="card overflow-hidden shadow-xl lg:sticky lg:top-24">
              <div className="relative aspect-video bg-gradient-to-br from-brand-700 to-night-800">
                {course.thumbnail?.url ? (
                  <Image src={course.thumbnail.url} alt={`${course.title} course thumbnail`} fill sizes="360px" className="object-cover" priority />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center font-display text-xl font-bold text-white/90">{course.title}</div>
                )}
              </div>
              <div className="space-y-4 p-6">
                {latest?.status !== "approved" && <p className="text-4xl font-extrabold text-ink">{formatTaka(course.price)}</p>}
                {cta}
                <ul className="space-y-2 border-t border-line pt-4 text-sm text-muted">
                  <li className="flex items-center gap-2">
                    <Icon name="video" className="size-4 text-brand-600" /> {lessons.length} video {lessons.length === 1 ? "lesson" : "lessons"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="file" className="size-4 text-brand-600" /> Downloadable lesson resources
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="gauge" className="size-4 text-brand-600" /> Progress tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="receipt" className="size-4 text-brand-600" /> Pay with bKash, Nagad or Rocket
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
