import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Container } from "@/components/ui";
import { COURSE_CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "About Onkur",
  description: "Onkur (অঙ্কুরণ) is an online learning platform for HSC ICT and modern web development, built around structured lessons, practice and teacher support.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES: Array<{ title: string; text: string; icon: IconName }> = [
  { title: "Structure", text: "Courses are broken into ordered lessons with clear goals, so you always know what to learn next.", icon: "layers" },
  { title: "Practice", text: "Every lesson can carry notes, slides and exercises — understanding grows when you try things yourself.", icon: "code" },
  { title: "Support", text: "Students can message their teacher about a specific lesson from inside the course.", icon: "chat" },
  { title: "Transparency", text: "Clear prices in taka, mobile-banking payments and a manual verification you can follow.", icon: "shield" },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(49,148,71,0.3),transparent_55%),radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.45),transparent_55%)]" />
        <Container className="relative grid items-center gap-10 py-16 lg:grid-cols-[1.4fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow text-sun-400">About Onkur</p>
            <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-6xl">
              অঙ্কুরণ means <span className="text-leaf-400">sprouting</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100/85">
              Every skill starts small. Onkur exists to help students in Bangladesh grow from their first lesson in ICT to building real things on the web — one clear, well-explained step at a time.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl">
            <Image src="/brand/logo-wordmark-transparent.png" alt="অঙ্কুরণ — Onkur logo" width={480} height={256} className="h-auto w-full" priority />
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="mission-title">
            <p className="eyebrow text-leaf-600">Our mission</p>
            <h2 id="mission-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              Make computer education clear, practical and reachable
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              Many students meet ICT as a list of definitions to memorise. We teach it the other way round: start from how computers, networks and programs actually work, then connect that understanding to the HSC syllabus and to the skills used in web development today.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Lessons are delivered as structured videos you can watch on a phone or a computer, with supporting materials and a direct line to your teacher.
            </p>
          </section>
          <section aria-labelledby="focus-title" className="card p-6 sm:p-8">
            <h2 id="focus-title" className="text-xl font-extrabold text-ink">
              What we teach
            </h2>
            <ul className="mt-5 space-y-4">
              {COURSE_CATEGORIES.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Icon name="check" className="mt-1 size-4 text-leaf-600" />
                  <span>
                    <span className="font-semibold text-ink">{c.label}</span>
                    <span className="block text-sm text-muted">{c.blurb}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="principles-title" className="mt-16">
          <h2 id="principles-title" className="text-center text-3xl font-extrabold text-ink">
            How we approach learning
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="card lift group p-6">
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon name={p.icon} className="size-6" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 flex flex-col items-center gap-4 rounded-[1.5rem] bg-gradient-to-br from-brand-700 to-night-900 px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold">Start growing today</h2>
          <p className="max-w-xl text-brand-100/85">Browse the courses, meet the teachers, or ask us anything.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/courses" className="btn-sun px-6 py-3">
              Explore Courses
            </Link>
            <Link href="/teachers" className="btn-ghost-dark px-6 py-3">
              Meet Our Teachers
            </Link>
            <Link href="/contact" className="btn-ghost-dark px-6 py-3">
              Contact Us
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
