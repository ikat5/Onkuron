import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { InteractiveLearning } from "@/components/home/interactive-learning";
import { LearningDiscovery } from "@/components/home/learning-discovery";
import { PromoHero } from "@/components/home/promo-hero";
import { Icon } from "@/components/icons";
import { InstructorCard } from "@/components/instructor-card";
import { SectionHeading } from "@/components/section-heading";
import { Container } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { listPublicCategories } from "@/services/categories";
import { listPublishedCourses } from "@/services/courses";
import { listPublicTopics } from "@/services/interactive";
import { getIntroSafe } from "@/services/settings";
import { listPublicTeacherProfiles } from "@/services/teacher-profile";

export const metadata: Metadata = {
  title: { absolute: "Onkur — Learn HSC ICT & Web Development Online | অঙ্কুরণ" },
  description: "Master HSC ICT and modern web development through structured video lessons, interactive visual labs, practical resources and guidance from dedicated teachers at Onkur (অঙ্কুরণ).",
  alternates: { canonical: "/" },
};

async function loadFeaturedCourses() {
  try {
    await connectDB();
    return await listPublishedCourses({ limit: 6 });
  } catch {
    return null;
  }
}

/**
 * Every section reads the database per request (the header reads the session
 * cookie, so the page is dynamically rendered): admin changes to the promo
 * video, categories and interactive lessons show on the next page load.
 */
export default async function Home() {
  const [intro, categories, topics, teachers, courses] = await Promise.all([getIntroSafe(), listPublicCategories(), listPublicTopics(), listPublicTeacherProfiles(), loadFeaturedCourses()]);

  return (
    <>
      {/* Promotional video hero (admin-managed, /admin/promo-video) */}
      <PromoHero intro={intro} />

      {/* Featured courses */}
      <section aria-labelledby="featured-title" className="bg-white py-20">
        <Container>
          <SectionHeading
            id="featured-title"
            eyebrow="Featured courses"
            title="Start with a course built for you"
            action={
              <Link href="/courses" className="btn-outline shrink-0">
                View all courses <Icon name="right" />
              </Link>
            }
          >
            Structured courses for HSC ICT and web development. Pick one, enroll, and start learning once your payment is verified.
          </SectionHeading>
          {courses === null ? (
            <p className="rounded-xl border border-line bg-canvas p-6 text-muted">Courses are temporarily unavailable. Please try again shortly.</p>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-canvas px-6 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
                <Icon name="sprout" className="size-7" />
              </span>
              <p className="mt-4 text-lg font-bold text-ink">New courses are being prepared</p>
              <p className="mt-1 max-w-md text-sm text-muted">Our first courses are on the way. Learn more about how Onkur works in the meantime.</p>
              <Link href="/about" className="btn-primary mt-5">
                About Onkur
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c, i) => (
                <CourseCard key={String(c._id)} course={c} priority={i < 3} index={i} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Learning discovery: admin-managed categories (/admin/categories) */}
      {categories.length > 0 && (
        <section aria-labelledby="categories-title" className="bg-canvas py-16 sm:py-20">
          <Container>
            <SectionHeading id="categories-title" eyebrow="Learning paths" title="What would you like to learn?" align="center">
              Choose a subject to see every course we teach in it.
            </SectionHeading>
            <LearningDiscovery categories={categories} />
          </Container>
        </section>
      )}

      {/* Motivation */}
      <section aria-labelledby="motivation-title" className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-night-900 py-20 text-white">
        <div aria-hidden className="pointer-events-none absolute top-1/2 right-[-6rem] size-96 -translate-y-1/2 animate-float rounded-full border-[3rem] border-white/5" />
        <Container className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow text-sun-400">Keep going</p>
            <h2 id="motivation-title" className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">
              Your next skill starts with your <span className="text-sun-400">next lesson</span>.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100/85">
              Understanding ICT and building for the web are skills that grow with consistent practice. A little every day — one lesson, one exercise, one question answered — adds up to real understanding you can use in exams and in your own projects.
            </p>
            <Link href="/courses" className="btn-sun mt-8 px-6 py-3.5 text-base">
              Start learning today <Icon name="right" />
            </Link>
          </div>
          <ul className="grid gap-3">
            {[
              ["Consistency", "Short, regular study beats last-minute cramming."],
              ["Practice", "Every lesson comes with material to try yourself."],
              ["Curiosity", "Ask why — your teacher is a message away."],
            ].map(([t, d]) => (
              <li key={t} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10">
                <Icon name="sparkle" className="mt-0.5 size-5 text-sun-400" />
                <span>
                  <span className="block font-display font-bold">{t}</span>
                  <span className="text-sm text-brand-100/80">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Instructor showcase (published teacher profiles only) */}
      {teachers.length > 0 && (
        <section aria-labelledby="instructors-title" className="bg-white py-20">
          <Container>
            <SectionHeading
              id="instructors-title"
              eyebrow="Our instructors"
              title="Instructor Collaborations"
              action={
                <Link href="/teachers" className="btn-outline shrink-0">
                  Meet Our Teachers <Icon name="right" />
                </Link>
              }
            >
              The teachers behind every Onkur course. Explore their background, then browse the courses they teach.
            </SectionHeading>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-8">
              {teachers.slice(0, 6).map((t) => (
                <li key={t.slug} className="w-full max-w-sm sm:w-[calc(50%-0.75rem)] sm:max-w-none lg:w-[calc((100%-3rem)/3)]">
                  <InstructorCard profile={t} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* Interactive visual learning, immediately above the footer (/admin/interactive) */}
      {topics.length > 0 && <InteractiveLearning topics={topics} />}
    </>
  );
}
