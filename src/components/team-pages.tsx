import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { TeacherCard } from "@/components/teacher-card";
import { TeacherProfileView } from "@/components/teacher-profile-view";
import { Container } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { TEAMS, type Team } from "@/lib/team";
import { getPublicTeacherProfile, listPublicTeacherProfiles } from "@/services/teacher-profile";

/** Public list and profile pages for the developer and video editor teams (teachers have their own richer page). */

const INTRO: Record<Exclude<Team, "teacher">, { eyebrow: string; title: string; text: string; description: string }> = {
  developer: {
    eyebrow: "Meet our developer team",
    title: "The people who build Onkur",
    text: "The developers behind the platform you learn on — the website, the classroom and everything that keeps it running.",
    description: "Meet the developers who build and run the Onkur learning platform.",
  },
  editor: {
    eyebrow: "Meet our video editor team",
    title: "The people behind every lesson video",
    text: "Our editors turn recorded classes into clear, well-paced lesson videos, so you can focus on learning.",
    description: "Meet the video editors who produce Onkur's lesson videos.",
  },
};

export function teamListMetadata(team: Exclude<Team, "teacher">): Metadata {
  const cfg = TEAMS[team];
  return { title: cfg.pageTitle, description: INTRO[team].description, alternates: { canonical: cfg.publicPath } };
}

export async function TeamListPublicPage({ team }: { team: Exclude<Team, "teacher"> }) {
  const cfg = TEAMS[team];
  const intro = INTRO[team];
  await connectDB().catch(() => null);
  const profiles = await listPublicTeacherProfiles(team);

  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(49,148,71,0.3),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(42,107,192,0.45),transparent_55%)]" />
        <Container className="relative py-16 lg:py-20">
          <p className="eyebrow text-sun-400">{intro.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-extrabold sm:text-6xl">{intro.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100/85">{intro.text}</p>
        </Container>
      </section>

      <Container className="py-14">
        {profiles.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Icon name={cfg.icon} className="size-8" />
            </span>
            <p className="mt-4 text-xl font-bold text-ink">Profiles are coming soon</p>
            <p className="mt-2 max-w-md text-sm text-muted">We&apos;re putting together our {cfg.plural.toLowerCase()}&apos; profiles. In the meantime, meet our teachers or browse the courses.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/teachers" className="btn-primary">
                Meet Our Teachers
              </Link>
              <Link href="/courses" className="btn-outline">
                Browse courses
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
      </Container>
    </>
  );
}

export async function teamProfileMetadata(team: Exclude<Team, "teacher">, slug: string): Promise<Metadata> {
  const cfg = TEAMS[team];
  await connectDB();
  const found = await getPublicTeacherProfile(slug, team);
  if (!found) return { title: "Profile not found", robots: { index: false } };
  const p = found.profile;
  const description = (p.shortBio || p.headline || `${p.displayName} is part of the Onkur team.`).slice(0, 160);
  return {
    title: `${p.displayName} — ${cfg.singular}`,
    description,
    alternates: { canonical: `${cfg.publicPath}/${p.slug}` },
    openGraph: { title: `${p.displayName} — Onkur ${cfg.singular.toLowerCase()}`, description, type: "profile", ...(p.photoUrl ? { images: [{ url: p.photoUrl, alt: p.displayName }] } : {}) },
  };
}

export async function TeamProfilePublicPage({ team, slug }: { team: Exclude<Team, "teacher">; slug: string }) {
  await connectDB();
  const found = await getPublicTeacherProfile(slug, team);
  if (!found) notFound();
  return <TeacherProfileView profile={found.profile} courses={[]} />;
}
