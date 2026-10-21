import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { HeroShowcase } from "@/components/home/hero-showcase";
import { IctLab } from "@/components/home/ict-lab/ict-lab";
import { Icon, type IconName } from "@/components/icons";
import { InstructorCard } from "@/components/instructor-card";
import { IntroVideo } from "@/components/intro-video";
import { SectionHeading } from "@/components/section-heading";
import { Container } from "@/components/ui";
import { categoryIcon, COURSE_CATEGORIES } from "@/lib/categories";
import { connectDB } from "@/lib/db";
import { countPublishedByCategory, listPublishedCourses } from "@/services/courses";
import { getIntroSafe } from "@/services/settings";
import { listPublicTeacherProfiles } from "@/services/teacher-profile";

export const metadata: Metadata = {
  title: { absolute: "Onkur — Learn HSC ICT & Web Development Online | অঙ্কুরণ" },
  description: "Master HSC ICT and modern web development through structured video lessons, practical resources and guidance from dedicated teachers at Onkur (অঙ্কুরণ).",
  alternates: { canonical: "/" },
};

const JOURNEY: Array<{ title: string; text: string; icon: IconName }> = [
  { title: "Discover the right course", text: "Browse HSC ICT and web development courses and read exactly what each one covers.", icon: "target" },
  { title: "Enroll and get approved", text: "Pay with bKash, Nagad or Rocket and submit your transaction ID. A teacher verifies it and unlocks the course.", icon: "shield" },
  { title: "Learn with video lessons", text: "Follow structured lessons in order, at your own pace, on your phone or computer.", icon: "video" },
  { title: "Practise with materials", text: "Download notes, slides and worksheets that go with every lesson.", icon: "file" },
  { title: "Track progress, ask questions", text: "See which lessons you've finished and message your teacher whenever you're stuck.", icon: "chat" },
  { title: "Keep building skills", text: "Apply what you learn in projects and move on to the next course when you're ready.", icon: "rocket" },
];

const WHY: Array<{ title: string; text: string; icon: IconName; tint: string }> = [
  { title: "Structured video lessons", text: "Every course is organised lesson by lesson, so you always know what comes next.", icon: "video", tint: "bg-brand-50 text-brand-700" },
  { title: "Learning resources", text: "PDFs, slides, documents and reading links attached directly to each lesson.", icon: "book", tint: "bg-leaf-50 text-leaf-700" },
  { title: "HSC ICT & web development", text: "A focused curriculum: from the HSC ICT syllabus to building modern websites.", icon: "code", tint: "bg-sun-50 text-sun-700" },
  { title: "Progress tracking", text: "Lessons complete as you watch, and your course progress is saved automatically.", icon: "gauge", tint: "bg-brand-50 text-brand-700" },
  { title: "Teacher communication", text: "Ask about a specific lesson from inside the course and get answers from your teacher.", icon: "chat", tint: "bg-leaf-50 text-leaf-700" },
  { title: "Clear enrollment", text: "Simple mobile-banking payment, manual verification and an email when you're approved.", icon: "receipt", tint: "bg-sun-50 text-sun-700" },
];

async function loadHome() {
  try {
    await connectDB();
    const [courses, counts] = await Promise.all([listPublishedCourses({ limit: 6 }), countPublishedByCategory()]);
    return { courses, counts };
  } catch {
    return { courses: null, counts: {} as Record<string, number> };
  }
}

export default async function Home() {
  const [{ courses, counts }, intro, teachers] = await Promise.all([loadHome(), getIntroSafe(), listPublicTeacherProfiles()]);

  return (
    <>
      {/* A + B: hero with the persistent animated showcase */}
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(49,148,71,0.25),transparent_50%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)] bg-[size:48px_48px]" />
        <Container className="relative grid items-center gap-10 py-8 sm:py-12 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20">
          <div className="lg:order-none order-last">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-100">
              <span className="size-1.5 rounded-full bg-leaf-400" /> অঙ্কুরণ · HSC ICT &amp; Web Development
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight min-[400px]:text-5xl sm:text-6xl lg:text-7xl">
              Learn Today.
              <br />
              <span className="bg-gradient-to-r from-sun-400 via-sun-500 to-leaf-400 bg-clip-text text-transparent">Build Tomorrow.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-brand-100/85 sm:text-lg">
              Master HSC ICT and modern web development through structured lessons, practical learning, and guidance from dedicated teachers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/courses" className="btn-sun px-6 py-3.5 text-base">
                Explore Courses <Icon name="right" />
              </Link>
              <Link href="/teachers" className="btn-ghost-dark px-6 py-3.5 text-base">
                Meet Our Teachers
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100/80">
              {["Video lessons", "Notes & slides", "Teacher support"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" className="size-4 text-leaf-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroShowcase />
        </Container>
      </section>

      {/* HSC ICT syllabus, animated and interactive */}
      <section aria-labelledby="ict-lab-title" className="bg-canvas py-16 sm:py-20">
        <Container>
          <SectionHeading id="ict-lab-title" eyebrow="HSC ICT Lab" title="See the HSC ICT syllabus come alive" align="center">
            Flip logic inputs, run a full adder, watch HTML build a page, trace a C program and query a database — the exact topics you will master in our HSC ICT course.
          </SectionHeading>
          <IctLab />
          <div className="mt-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
            <Link href="/courses?category=hsc-ict" className="btn-primary px-6 py-3.5 text-base">
              Enroll in HSC ICT <Icon name="right" />
            </Link>
            <Link href="/register" className="btn-outline px-6 py-3.5 text-base">
              Create a free account
            </Link>
          </div>
        </Container>
      </section>

      {/* C: featured courses */}
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

      {/* D: categories */}
      <section aria-labelledby="categories-title" className="bg-canvas py-20">
        <Container>
          <SectionHeading id="categories-title" eyebrow="Learning paths" title="What would you like to learn?" align="center">
            SSC and HSC science, ICT and programming — choose a path and filter the catalogue.
          </SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COURSE_CATEGORIES.map((c) => {
              const n = counts[c.id] ?? 0;
              return (
                <li key={c.id}>
                  <Link href={`/courses?category=${c.id}`} className="card lift group flex h-full items-start gap-4 p-5 hover:border-brand-200">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition duration-300 group-hover:-rotate-6 group-hover:bg-brand-600 group-hover:text-white">
                      <Icon name={categoryIcon(c.id)} className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-display text-lg font-bold text-ink">{c.label}</span>
                        <Icon name="right" className="size-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{c.blurb}</span>
                      <span className="mt-3 block text-xs font-semibold text-leaf-700">{n > 0 ? `${n} course${n === 1 ? "" : "s"}` : "Coming soon"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* E: platform introduction video (teacher-configured) */}
      <section aria-label="How Onkur works" className="bg-white py-20">
        <Container>
          <IntroVideo
            intro={intro}
            eyebrow="Discover Onkur"
            cta={
              <>
                <Link href="/courses" className="btn-primary px-5 py-3">
                  Find your course
                </Link>
                <Link href="/register" className="btn-outline px-5 py-3">
                  Create a free account
                </Link>
              </>
            }
          >
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["For HSC students", "Clear explanations of the ICT syllabus."],
                ["For aspiring developers", "Hands-on web development, step by step."],
                ["Learn anywhere", "Lessons work on phones and computers."],
                ["Real teacher support", "Ask questions inside every course."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <Icon name="check" className="mt-1 size-4 text-leaf-600" />
                  <span>
                    <span className="block text-sm font-bold text-ink">{t}</span>
                    <span className="text-sm text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </IntroVideo>
        </Container>
      </section>

      {/* F: learning journey */}
      <section aria-labelledby="journey-title" className="bg-canvas py-20">
        <Container>
          <SectionHeading id="journey-title" eyebrow="Your learning journey" title="Six steps from curious to capable" align="center">
            This is exactly how learning on Onkur works — no surprises.
          </SectionHeading>
          <ol className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {JOURNEY.map((s, i) => (
              <li key={s.title} className="card lift group relative overflow-hidden p-6">
                <span aria-hidden className="absolute -top-3 -right-1 font-display text-8xl font-extrabold text-brand-50 transition-colors group-hover:text-sun-50">
                  {i + 1}
                </span>
                <span className="relative flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white transition group-hover:bg-sun-500 group-hover:text-ink">
                  <Icon name={s.icon} className="size-5" />
                </span>
                <p className="relative mt-4 text-xs font-bold text-leaf-700">Step {i + 1}</p>
                <h3 className="relative mt-1 text-lg font-bold text-ink">{s.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* F: motivation */}
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

      {/* G: instructor showcase (published teacher profiles only) */}
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

      {/* H: why Onkur */}
      <section aria-labelledby="why-title" className="bg-canvas py-20">
        <Container>
          <SectionHeading id="why-title" eyebrow="Why learn with Onkur?" title="Everything you need to learn — in one place" align="center" />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((f) => (
              <li key={f.title} className="card lift group p-6">
                <span className={`flex size-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${f.tint}`}>
                  <Icon name={f.icon} className="size-6" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-14 flex flex-col items-center gap-4 rounded-[1.5rem] bg-night-900 px-6 py-10 text-center text-white sm:px-10">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to start your first lesson?</h2>
            <p className="max-w-xl text-brand-100/80">Create a free account, choose a course and enroll in minutes.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/courses" className="btn-sun px-6 py-3">
                Explore Courses
              </Link>
              <Link href="/contact" className="btn-ghost-dark px-6 py-3">
                Ask us a question
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
