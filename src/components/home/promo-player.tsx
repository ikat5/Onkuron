"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/youtube";

/** Cloudinary renders a still frame of a video when its URL asks for an image format. */
const videoFrame = (url: string) => url.replace(/\.[a-z0-9]+$/i, ".jpg");

/**
 * Promotional video player: an uploaded video file or a YouTube video. The
 * 16:9 box is reserved up front (no layout shift) and only the poster image
 * loads with the page; the video (or the privacy-enhanced YouTube player)
 * loads when the visitor presses play, so nothing plays with sound unasked.
 * Render with `key` = the video's URL or ID to reset after a change.
 */
export function PromoPlayer({ videoId, videoUrl, title, thumbnailUrl, priority = false }: { videoId?: string; videoUrl?: string; title: string; thumbnailUrl?: string; priority?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState(thumbnailUrl ?? (videoUrl ? videoFrame(videoUrl) : videoId ? youtubeThumbnail(videoId, "maxresdefault") : undefined));

  if (!videoId && !videoUrl) {
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-night-800 via-brand-800 to-night-900 p-6 text-center text-white">
        {thumbnailUrl && <Image src={thumbnailUrl} alt="" fill priority={priority} sizes="(min-width: 1024px) 960px, 100vw" className="object-cover opacity-40" />}
        <span className="relative flex size-16 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm">
          <Icon name="play" className="ml-1 size-7 text-white/80" />
        </span>
        <p className="relative font-display text-lg font-bold sm:text-xl">Our introduction video is coming soon</p>
        <p className="relative max-w-sm text-sm text-brand-100/80">Meanwhile, browse the courses or send us a question.</p>
        <div className="relative flex gap-2">
          <Link href="/courses" className="btn-sun px-3 py-1.5 text-xs">
            Browse courses
          </Link>
          <Link href="/contact" className="btn-ghost-dark px-3 py-1.5 text-xs">
            Ask a question
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-night-900">
      {playing && videoUrl ? (
        <video src={videoUrl} poster={poster} title={title} controls autoPlay playsInline className="absolute inset-0 size-full bg-black object-contain" />
      ) : playing && videoId ? (
        <iframe
          src={youtubeEmbedUrl(videoId, { autoplay: true, origin: window.location.origin })}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 size-full cursor-pointer" aria-label={`Play video: ${title}`}>
          {poster && (
            <Image
              src={poster}
              alt=""
              fill
              unoptimized={!thumbnailUrl && !videoUrl}
              priority={priority}
              sizes="(min-width: 1024px) 960px, 100vw"
              className="object-cover transition duration-700 ease-out-soft group-hover:scale-[1.02]"
              // YouTube has no maxres image for some videos: fall back to the always-present one.
              onError={() => !thumbnailUrl && videoId && setPoster(youtubeThumbnail(videoId, "hqdefault"))}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-night-950/70 via-night-950/10 to-transparent" />
          <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <span aria-hidden className="absolute size-20 animate-pulse-soft rounded-full bg-white/25 motion-reduce:animate-none sm:size-28" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-white text-brand-700 shadow-2xl transition duration-300 group-hover:scale-110 group-hover:bg-sun-500 group-hover:text-ink sm:size-20">
              <Icon name="play" className="ml-1 size-7 sm:size-8" />
            </span>
          </span>
          <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-night-950/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:bottom-4 sm:left-4">
            <Icon name="video" className="size-3.5 text-sun-400" /> Watch the introduction
          </span>
        </button>
      )}
    </div>
  );
}
