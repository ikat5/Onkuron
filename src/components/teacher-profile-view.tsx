import Link from "next/link";
import { CourseCard, type CourseCardData } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { TeacherAvatar } from "@/components/teacher-card";
import { Container } from "@/components/ui";
import { YouTubePreview } from "@/components/youtube-preview";
import type { PublicTeacherProfile } from "@/services/teacher-profile";

/** Public profile layout, shared by /teachers/[slug] and the teacher's private preview. */
export function TeacherProfileView({ profile, courses }: { profile: PublicTeacherProfile; courses: Array<CourseCardData & { _id: unknown }> }) {
  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.5),transparent_55%)]" />
        <Container className="relative grid items-center gap-10 py-14 md:grid-cols-[280px_1fr] lg:py-20">
          <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-[2rem] border-4 border-white/10 shadow-2xl md:w-full">
            <TeacherAvatar profile={profile} />
          </div>
          <div>
            <Link href="/teachers" className="inline-flex items-center gap-1 text-sm text-brand-200 hover:text-white">
              <Icon name="left" /> All teachers
            </Link>
            <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">{profile.displayName}</h1>
            {profile.headline && <p className="mt-2 text-lg font-semibold text-sun-400">{profile.headline}</p>}
            {profile.shortBio && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-brand-100/85">{profile.shortBio}</p>}
            {profile.subjects.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Subjects taught">
                {profile.subjects.map((s) => (
                  <li key={s} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      <Container className="py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            {profile.bio && (
              <section aria-labelledby="bio-title" className="card p-6 sm:p-8">
                <h2 id="bio-title" className="text-2xl font-extrabold text-ink">
                  About {profile.displayName}
                </h2>
                <p className="mt-4 leading-relaxed whitespace-pre-line text-ink">{profile.bio}</p>
              </section>
            )}
            {profile.youtubeVideoId && (
              <section aria-labelledby="intro-title">
                <h2 id="intro-title" className="mb-4 text-2xl font-extrabold text-ink">
                  Introduction
                </h2>
                <div className="overflow-hidden rounded-2xl shadow-xl">
                  <YouTubePreview videoId={profile.youtubeVideoId} title={`${profile.displayName} introduction`} />
                </div>
              </section>
            )}
            {profile.philosophy && (
              <section aria-labelledby="philosophy-title" className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-brand-700 to-night-900 p-8 text-white">
                <Icon name="sparkle" className="absolute top-6 right-6 size-10 text-white/10" />
                <h2 id="philosophy-title" className="eyebrow text-sun-400">
                  Teaching philosophy
                </h2>
                <p className="mt-4 font-display text-xl leading-relaxed font-semibold whitespace-pre-line">{profile.philosophy}</p>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            {profile.achievements.length > 0 && (
              <section aria-labelledby="ach-title" className="card p-6">
                <h2 id="ach-title" className="flex items-center gap-2 text-lg font-extrabold text-ink">
                  <Icon name="trophy" className="size-5 text-sun-600" /> Achievements
                </h2>
                <ol className="mt-4 space-y-4 border-l-2 border-sun-100 pl-4">
                  {profile.achievements.map((a) => (
                    <li key={a.id} className="relative">
                      <span aria-hidden className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-sun-500 ring-4 ring-white" />
                      <p className="font-semibold text-ink">{a.title}</p>
                      {a.year && <p className="text-xs font-semibold text-sun-700">{a.year}</p>}
                      {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {profile.expertise.length > 0 && (
              <section aria-labelledby="exp-title" className="card p-6">
                <h2 id="exp-title" className="text-lg font-extrabold text-ink">
                  Expertise
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {profile.expertise.map((e) => (
                    <li key={e} className="badge bg-leaf-50 text-leaf-700">
                      {e}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {courses.length > 0 && (
          <section aria-labelledby="courses-title" className="mt-14">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 id="courses-title" className="text-2xl font-extrabold text-ink sm:text-3xl">
                Courses
              </h2>
              <Link href="/courses" className="text-sm font-semibold text-brand-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={String(c._id)} course={c} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
