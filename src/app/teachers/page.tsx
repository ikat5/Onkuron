import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { TeacherCard } from "@/components/teacher-card";
import { Container } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { listPublicTeacherProfiles } from "@/services/teacher-profile";

export const metadata: Metadata = {
  title: "Meet Our Teachers",
  description: "Meet the teachers behind Onkur's HSC ICT and web development courses — their subjects, experience and approach to teaching.",
  alternates: { canonical: "/teachers" },
};

const APPROACH = [
  { title: "Concepts before shortcuts", text: "Every topic starts from the idea behind it, so you can solve questions you haven't seen before.", icon: "target" as const },
  { title: "Learn by doing", text: "Lessons come with notes, exercises and small projects to practise straight away.", icon: "code" as const },
  { title: "Questions welcome", text: "Ask about any lesson from inside the course — no question is too small.", icon: "chat" as const },
];

export default async function TeachersPage() {
  await connectDB().catch(() => null);
  const profiles = await listPublicTeacherProfiles();

  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(49,148,71,0.3),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(42,107,192,0.45),transparent_55%)]" />
        <Container className="relative pt-14 pb-24 lg:pt-20 lg:pb-28">
          <p className="eyebrow text-sun-400">Meet our teachers</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-extrabold sm:text-6xl">The people who will teach you</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100/85">
            Before you enroll, get to know who&apos;s behind the lessons — what they teach, how they teach, and what they&apos;ve achieved.
          </p>
        </Container>
      </section>

      {/* Teacher cards rise into the header, so the page reads as one composition. */}
      <Container className="relative -mt-14 pb-14 lg:-mt-16">
        {profiles.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Icon name="user" className="size-8" />
            </span>
            <p className="mt-4 text-xl font-bold text-ink">Teacher profiles are coming soon</p>
            <p className="mt-2 max-w-md text-sm text-muted">We&apos;re putting together our teachers&apos; profiles. In the meantime, you can browse the courses or contact us with any question.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/courses" className="btn-primary">
                Browse courses
              </Link>
              <Link href="/contact" className="btn-outline">
                Contact us
              </Link>
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 ${profiles.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-4xl"}`}>
            {profiles.map((p) => (
              <TeacherCard key={p.slug} profile={p} />
            ))}
          </div>
        )}

        <section aria-labelledby="approach-title" className="mt-16">
          <h2 id="approach-title" className="text-center text-3xl font-extrabold text-ink">
            How we teach
          </h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {APPROACH.map((a) => (
              <li key={a.title} className="card lift group p-6">
                <span className="flex size-12 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700 transition group-hover:scale-110">
                  <Icon name={a.icon} className="size-6" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </>
  );
}
