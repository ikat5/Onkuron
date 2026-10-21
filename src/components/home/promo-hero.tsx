import Link from "next/link";
import { Icon } from "@/components/icons";
import { Container } from "@/components/ui";
import type { PlatformIntro } from "@/services/settings";
import { PromoPlayer } from "./promo-player";

/**
 * Homepage hero: the admin-managed promotional video is the main visual,
 * framed by the heading and calls to action. With the video section switched
 * off it falls back to a text-only hero so the page still opens complete.
 * Also rendered as the live preview in /admin/promo-video.
 */
export function PromoHero({ intro, preview = false }: { intro: Pick<PlatformIntro, "youtubeVideoId" | "videoUrl" | "title" | "text" | "enabled" | "thumbnailUrl">; preview?: boolean }) {
  const Heading = preview ? "p" : "h1";
  return (
    <section aria-labelledby={preview ? undefined : "hero-title"} className="relative isolate overflow-hidden bg-night-900 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(42,107,192,0.5),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(49,148,71,0.22),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(245,166,35,0.12),transparent_45%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] bg-[size:48px_48px]" />
      <Container className={`relative flex flex-col items-center text-center ${preview ? "py-8" : "pt-10 pb-14 sm:pt-14 sm:pb-20"}`}>
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-100">
          <span className="size-1.5 rounded-full bg-leaf-400" /> অঙ্কুরণ · HSC ICT &amp; Web Development
        </p>
        <Heading id={preview ? undefined : "hero-title"} className="mt-5 max-w-4xl text-3xl leading-[1.1] font-extrabold tracking-tight text-balance min-[400px]:text-4xl sm:text-5xl lg:text-6xl">
          {intro.title}
        </Heading>
        {intro.text && <p className="mt-4 line-clamp-4 max-w-2xl text-base leading-relaxed whitespace-pre-line text-brand-100/85 sm:text-lg">{intro.text}</p>}

        {intro.enabled && (
          <div className="relative mt-8 w-full max-w-5xl sm:mt-10">
            <div aria-hidden className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/50 via-leaf-500/25 to-sun-500/35 opacity-80 blur-2xl sm:-inset-5" />
            <div className="overflow-hidden rounded-[1.25rem] border border-white/15 bg-night-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/5 sm:rounded-[1.75rem]">
              <PromoPlayer key={intro.videoUrl ?? intro.youtubeVideoId ?? "none"} videoId={intro.youtubeVideoId} videoUrl={intro.videoUrl} title={intro.title} thumbnailUrl={intro.thumbnailUrl} priority={!preview} />
            </div>
          </div>
        )}

        <div className={`flex flex-wrap justify-center gap-3 ${intro.enabled ? "mt-8 sm:mt-10" : "mt-8"}`}>
          <Link href="/courses" className="btn-sun px-6 py-3.5 text-base">
            Explore Courses <Icon name="right" />
          </Link>
          <Link href="/teachers" className="btn-ghost-dark px-6 py-3.5 text-base">
            Meet Our Teachers
          </Link>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-brand-100/80">
          {["Video lessons", "Notes & slides", "Interactive ICT labs", "Teacher support"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Icon name="check" className="size-4 text-leaf-400" /> {t}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
