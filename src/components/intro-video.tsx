import type { ReactNode } from "react";
import type { PlatformIntro } from "@/services/settings";
import { PromoPlayer } from "./home/promo-player";

/**
 * Two-column platform introduction: text on the left, the promotional video on
 * the right (click-to-load, no autoplay). Without a video it shows a
 * placeholder instead of a broken player.
 */
export function IntroVideo({
  intro,
  eyebrow = "Discover Onkur",
  children,
  cta,
  tone = "light",
  compact = false,
}: {
  intro: PlatformIntro;
  eyebrow?: string;
  children?: ReactNode;
  cta?: ReactNode;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <div className={`grid items-center gap-8 ${compact ? "lg:grid-cols-[1fr_1.1fr]" : "gap-10 lg:grid-cols-2 lg:gap-14"}`}>
      <div>
        <p className={`eyebrow mb-3 ${dark ? "text-sun-400" : "text-leaf-600"}`}>{eyebrow}</p>
        <h2 className={`${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} leading-tight font-extrabold ${dark ? "text-white" : "text-ink"}`}>{intro.title}</h2>
        <p className={`mt-4 leading-relaxed whitespace-pre-line ${dark ? "text-brand-100/85" : "text-muted"}`}>{intro.text}</p>
        {children}
        {cta && <div className="mt-6 flex flex-wrap gap-3">{cta}</div>}
      </div>
      <div className="relative">
        <div aria-hidden className={`absolute -inset-3 rounded-[1.5rem] ${dark ? "bg-gradient-to-br from-brand-500/30 to-leaf-500/20" : "bg-gradient-to-br from-brand-100 to-leaf-100"} blur-xl`} />
        <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
          <PromoPlayer key={intro.videoUrl ?? intro.youtubeVideoId ?? "none"} videoId={intro.youtubeVideoId} videoUrl={intro.videoUrl} title={intro.title} thumbnailUrl={intro.thumbnailUrl} />
        </div>
      </div>
    </div>
  );
}
