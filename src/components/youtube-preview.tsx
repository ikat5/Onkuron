"use client";

import Image from "next/image";
import { useState } from "react";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/youtube";
import { Icon } from "./icons";

/**
 * Click-to-load YouTube preview: only the thumbnail image is fetched until
 * the viewer presses play, then the privacy-enhanced (youtube-nocookie)
 * player is embedded. Render with `key={videoId}` to reset on change.
 */
export function YouTubePreview({ videoId, title }: { videoId: string; title: string }) {
  const [active, setActive] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-brand-900">
      {active ? (
        <iframe
          src={youtubeEmbedUrl(videoId, { autoplay: true, origin: window.location.origin })}
          title={`Video preview: ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button type="button" onClick={() => setActive(true)} className="group absolute inset-0 size-full" aria-label={`Play video preview: ${title}`}>
          <Image src={youtubeThumbnail(videoId)} alt="" fill unoptimized sizes="(min-width: 640px) 640px, 100vw" className="object-cover opacity-90 transition group-hover:opacity-100" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg transition group-hover:scale-105">
            <Icon name="play" className="ml-1 size-7" />
          </span>
          <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">Click to load preview</span>
        </button>
      )}
    </div>
  );
}
