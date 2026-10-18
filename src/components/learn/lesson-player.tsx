"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { YOUTUBE_EMBED_ORIGIN, youtubeThumbnail } from "@/lib/youtube";
import type { ProgressDTO } from "@/services/progress";

/* ---------- Minimal typings for the YouTube IFrame Player API ---------- */

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;
const PAUSED = 2;
const ENDED = 0;

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the official IFrame API once, only when a student starts a video. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const YT_ERRORS: Record<number, string> = {
  2: "This lesson's video link is invalid. Please tell your teacher.",
  5: "Your browser can't play this video. Try another browser.",
  100: "This video was removed or set to private on YouTube. Please tell your teacher.",
  101: "The video's owner doesn't allow it to be played on other sites. Please tell your teacher.",
  150: "The video's owner doesn't allow it to be played on other sites. Please tell your teacher.",
  153: "YouTube couldn't verify this site. Reload the page and try again.",
};

/* ---------- Player abstraction (YouTube or legacy <video>) ---------- */

interface Adapter {
  time(): number;
  duration(): number;
  rate(): number;
  rates(): number[];
  setRate(rate: number): void;
  playing(): boolean;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
}

const ytAdapter = (p: YTPlayer): Adapter => ({
  time: () => p.getCurrentTime() || 0,
  duration: () => p.getDuration() || 0,
  rate: () => p.getPlaybackRate() || 1,
  rates: () => p.getAvailablePlaybackRates() ?? [1],
  setRate: (r) => p.setPlaybackRate(r),
  playing: () => p.getPlayerState() === PLAYING,
  play: () => p.playVideo(),
  pause: () => p.pauseVideo(),
  seek: (s) => p.seekTo(s, true),
});

const HTML_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const htmlAdapter = (v: HTMLVideoElement): Adapter => ({
  time: () => v.currentTime || 0,
  duration: () => (Number.isFinite(v.duration) ? v.duration : 0),
  rate: () => v.playbackRate,
  rates: () => HTML_RATES,
  setRate: (r) => {
    v.playbackRate = r;
  },
  playing: () => !v.paused && !v.ended,
  play: () => void v.play().catch(() => {}),
  pause: () => v.pause(),
  seek: (s) => {
    v.currentTime = s;
  },
});

const RATE_KEY = "onkuron:playbackRate";
function savedRate() {
  try {
    return Number(localStorage.getItem(RATE_KEY)) || 1;
  } catch {
    return 1;
  }
}
function saveRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {}
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/* ---------- Component ---------- */

/**
 * Lesson video player. YouTube lessons use the official IFrame Player API on
 * the privacy-enhanced youtube-nocookie.com host with YouTube's own controls
 * (play/pause, seek, speed, captions, quality, fullscreen). A control bar
 * below the video adds skip, speed memory and resume; nothing is overlaid on
 * YouTube's player. Real playback time (not seeking) is reported to the
 * server, which decides completion.
 */
export function LessonPlayer({
  lessonId,
  title,
  youtubeVideoId,
  legacySrc,
  videoKey,
  resumeAt = 0,
  track,
  onProgress,
  onEnded,
}: {
  lessonId: string;
  title: string;
  youtubeVideoId?: string;
  /** Enrollment-checked URL of a legacy (pre-YouTube) uploaded video. */
  legacySrc?: string;
  videoKey?: string;
  resumeAt?: number;
  /** Report progress (students only). */
  track: boolean;
  onProgress?: (p: ProgressDTO) => void;
  onEnded?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const adapterRef = useRef<Adapter | null>(null);
  const tracker = useRef({ last: 0, pending: 0, lastSent: 0 });
  const latest = useRef({ lessonId, videoKey, track, onProgress, onEnded });
  useEffect(() => {
    latest.current = { lessonId, videoKey, track, onProgress, onEnded };
  });

  const [activated, setActivated] = useState(!youtubeVideoId);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(resumeAt);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [rates, setRates] = useState<number[]>([1]);
  const [error, setError] = useState<string | null>(null);

  /** Sends accumulated watch time + position. `keepalive` lets it survive page unload. */
  const flush = useCallback((keepalive = false) => {
    const { track, lessonId, videoKey, onProgress } = latest.current;
    const a = adapterRef.current;
    if (!track || !a || !videoKey) return;
    const t = tracker.current;
    const delta = Math.min(600, Math.round(t.pending * 10) / 10);
    t.pending = 0;
    t.lastSent = Date.now();
    fetch(`/api/learn/lessons/${lessonId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive,
      body: JSON.stringify({ videoKey, positionSeconds: Math.floor(a.time()), durationSeconds: Math.floor(a.duration()), watchedDelta: delta }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { progress?: ProgressDTO }) => d.progress && onProgress?.(d.progress))
      .catch(() => {
        t.pending += delta; // retry with the next report
      });
  }, []);

  function onAdapterReady(a: Adapter) {
    adapterRef.current = a;
    tracker.current.last = a.time();
    tracker.current.lastSent = Date.now();
    const available = a.rates();
    setRates(available);
    const preferred = savedRate();
    if (preferred !== 1 && available.includes(preferred)) a.setRate(preferred);
    setRate(available.includes(preferred) ? preferred : 1);
    setDuration(a.duration());
    setReady(true);
  }

  function onStateChange(state: "playing" | "paused" | "ended") {
    setPlaying(state === "playing");
    if (state !== "playing") flush();
    if (state === "ended") latest.current.onEnded?.();
  }

  // YouTube: create the player only after the student presses play.
  useEffect(() => {
    if (!activated || !youtubeVideoId) return;
    let player: YTPlayer | null = null;
    let cancelled = false;
    const host = hostRef.current;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host) return;
        const mount = document.createElement("div");
        host.replaceChildren(mount);
        player = new YT.Player(mount, {
          host: YOUTUBE_EMBED_ORIGIN,
          videoId: youtubeVideoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            controls: 1,
            fs: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
            ...(resumeAt > 0 ? { start: Math.floor(resumeAt) } : {}),
          },
          events: {
            onReady: () => {
              if (!player) return;
              player.getIframe().title = `Lesson video: ${title}`;
              onAdapterReady(ytAdapter(player));
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === PLAYING) {
                setDuration(player?.getDuration() ?? 0);
                onStateChange("playing");
              } else if (e.data === PAUSED) onStateChange("paused");
              else if (e.data === ENDED) onStateChange("ended");
            },
            onPlaybackRateChange: (e: { data: number }) => {
              setRate(e.data);
              saveRate(e.data);
            },
            onError: (e: { data: number }) => setError(YT_ERRORS[e.data] ?? "The video couldn't be played. Reload the page and try again."),
          },
        });
      })
      .catch(() => setError("Couldn't load the YouTube player. Check your connection (or ad/privacy blockers) and reload."));
    return () => {
      cancelled = true;
      flush(true);
      adapterRef.current = null;
      try {
        player?.destroy();
      } catch {}
      host?.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate only when the video changes
  }, [activated, youtubeVideoId]);

  // Legacy <video>: flush on unmount.
  useEffect(() => {
    if (youtubeVideoId) return;
    return () => {
      flush(true);
      adapterRef.current = null;
    };
  }, [youtubeVideoId, flush]);

  // Measure real playback once per second; seeks show up as jumps and are ignored.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const a = adapterRef.current;
      if (!a) return;
      const t = a.time();
      const tr = tracker.current;
      if (a.playing()) {
        const d = t - tr.last;
        if (d > 0 && d <= a.rate() * 1.5 + 0.75) tr.pending += d;
        if (tr.pending >= 15 || Date.now() - tr.lastSent > 20_000) flush();
      }
      tr.last = t;
      setTime(t);
    }, 1000);
    const onHide = () => document.visibilityState === "hidden" && flush(true);
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [ready, flush]);

  const skip = (by: number) => {
    const a = adapterRef.current;
    if (!a) return;
    const t = Math.min(Math.max(0, a.time() + by), a.duration() || Infinity);
    a.seek(t);
    tracker.current.last = t;
    setTime(t);
  };
  const changeRate = (r: number) => {
    adapterRef.current?.setRate(r);
    setRate(r);
    saveRate(r);
  };

  /* ----- Fullscreen: the browser Fullscreen API, or a full-viewport fallback (e.g. iPhone Safari) ----- */
  const shellRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [apiFullscreen, setApiFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const fullscreen = apiFullscreen || cssFullscreen;

  useEffect(() => {
    const doc = document as FsDocument;
    const onChange = () => setApiFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement) && (document.fullscreenElement ?? doc.webkitFullscreenElement) === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!cssFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCssFullscreen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [cssFullscreen]);

  async function toggleFullscreen() {
    const doc = document as FsDocument;
    const el = shellRef.current as FsElement | null;
    if (!el) return;
    if (cssFullscreen) return setCssFullscreen(false);
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    setMiniManual(false);
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (!request) return setCssFullscreen(true);
    try {
      await request();
      // Phones: turn to landscape where the browser allows it.
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
    } catch {
      setCssFullscreen(true);
    }
  }

  /* ----- Mini player: floats in the corner while the student reads the resources below ----- */
  const [miniManual, setMiniManual] = useState(false);
  const [outOfView, setOutOfView] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number>();
  const mini = !fullscreen && (miniManual || (outOfView && playing && !dismissed));

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const away = entry.intersectionRatio < 0.35;
        if (away && shellRef.current && !anchor.style.height) setPlaceholderHeight(shellRef.current.offsetHeight);
        setOutOfView(away);
        if (!away) setDismissed(false);
      },
      { threshold: [0, 0.35, 1] },
    );
    io.observe(anchor);
    return () => io.disconnect();
  }, []);

  function minimize() {
    if (shellRef.current) setPlaceholderHeight(shellRef.current.offsetHeight);
    setDismissed(false);
    setMiniManual(true);
  }
  function restore() {
    setMiniManual(false);
    setDismissed(true);
    anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function closeMini() {
    adapterRef.current?.pause();
    setMiniManual(false);
    setDismissed(true);
  }

  const hasVideo = Boolean(youtubeVideoId || legacySrc) && !error;
  const shellClass = fullscreen
    ? `flex flex-col bg-black ${cssFullscreen ? "fixed inset-0 z-[70]" : "size-full"}`
    : mini
      ? "fixed right-3 bottom-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-white shadow-2xl sm:right-5 sm:bottom-5"
      : "overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm";
  const iconBtn = `flex h-9 items-center gap-1 rounded-lg px-2 disabled:opacity-40 ${fullscreen ? "text-white hover:bg-white/10" : "text-ink hover:bg-brand-50"}`;

  return (
    <div ref={anchorRef} style={mini ? { height: placeholderHeight } : undefined}>
      {mini && (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-canvas p-4 text-center text-sm text-muted">
          <Icon name="pip" className="size-6" />
          Playing in the mini player
          <button type="button" className="btn-outline px-3 py-1.5" onClick={restore}>
            Bring it back here
          </button>
        </div>
      )}
      <div ref={shellRef} className={shellClass} role={mini ? "region" : undefined} aria-label={mini ? "Mini player" : undefined}>
        {mini && (
          <div className="flex items-center gap-2 border-b border-line bg-brand-700 px-3 py-1.5 text-white">
            <p className="min-w-0 flex-1 truncate text-xs font-medium">{title}</p>
            <button type="button" className="rounded p-1 hover:bg-white/15" onClick={restore} aria-label="Restore video" title="Restore">
              <Icon name="expand" className="size-4" />
            </button>
            <button type="button" className="rounded p-1 hover:bg-white/15" onClick={closeMini} aria-label="Close mini player" title="Close (pauses the video)">
              <Icon name="x" className="size-4" />
            </button>
          </div>
        )}
        <div className={`relative w-full bg-black ${fullscreen ? "min-h-0 flex-1" : "aspect-video"}`}>
          {error ? (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-900 p-6 text-center text-sm text-white">
              <Icon name="alert" className="size-8 text-sun-400" />
              <p className="max-w-sm">{error}</p>
            </div>
          ) : youtubeVideoId ? (
            activated ? (
              <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full" />
            ) : (
              <button type="button" onClick={() => setActivated(true)} className="group absolute inset-0 size-full" aria-label={`Play lesson video: ${title}`}>
                <Image src={youtubeThumbnail(youtubeVideoId, "hqdefault")} alt="" fill unoptimized priority sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="absolute top-1/2 left-1/2 flex size-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sun-500 text-white shadow-xl transition group-hover:scale-105 group-hover:bg-sun-600">
                  <Icon name="play" className="ml-1 size-8" />
                </span>
                {resumeAt > 0 && <span className="absolute bottom-4 left-4 rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white">Resume from {formatTime(resumeAt)}</span>}
              </button>
            )
          ) : legacySrc ? (
            <video
              ref={videoRef}
              key={lessonId}
              controls
              controlsList="nodownload"
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full"
              src={legacySrc}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (resumeAt > 0 && resumeAt < v.duration - 5) v.currentTime = resumeAt;
                onAdapterReady(htmlAdapter(v));
              }}
              onPlay={() => onStateChange("playing")}
              onPause={(e) => !e.currentTarget.ended && onStateChange("paused")}
              onEnded={() => onStateChange("ended")}
              onRateChange={(e) => {
                setRate(e.currentTarget.playbackRate);
                saveRate(e.currentTarget.playbackRate);
              }}
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-50 text-sm text-muted">
              <Icon name="video" className="size-8" />
              The video for this lesson is coming soon.
            </div>
          )}
        </div>

        {hasVideo && (
          <div className={`flex flex-wrap items-center gap-1 px-2 py-2 text-sm sm:gap-2 sm:px-3 ${fullscreen ? "bg-brand-900 text-white" : "border-t border-line"}`}>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              onClick={() => (!activated ? setActivated(true) : playing ? adapterRef.current?.pause() : adapterRef.current?.play())}
              disabled={activated && !ready}
              aria-label={playing ? "Pause" : "Play"}
            >
              <Icon name={playing ? "pause" : "play"} className="size-4" />
            </button>
            {!mini && (
              <>
                <button type="button" className={iconBtn} onClick={() => skip(-10)} disabled={!ready} aria-label="Back 10 seconds" title="Back 10 seconds">
                  <Icon name="back10" /> <span className="text-xs">10s</span>
                </button>
                <button type="button" className={iconBtn} onClick={() => skip(10)} disabled={!ready} aria-label="Forward 10 seconds" title="Forward 10 seconds">
                  <span className="text-xs">10s</span> <Icon name="fwd10" />
                </button>
              </>
            )}
            <span className={`px-1 font-mono text-xs tabular-nums ${fullscreen ? "text-brand-100" : "text-muted"}`} aria-label="Playback time">
              {formatTime(time)} / {duration ? formatTime(duration) : "--:--"}
            </span>
            {!mini && (
              <div className="ml-auto flex items-center gap-1">
                <label className={`flex items-center gap-1.5 text-xs ${fullscreen ? "text-brand-100" : "text-muted"}`}>
                  <Icon name="gauge" />
                  <span className="sr-only sm:not-sr-only">Speed</span>
                  <select className="rounded-md border border-line bg-white px-1.5 py-1 text-xs text-ink disabled:opacity-50" value={rate} onChange={(e) => changeRate(Number(e.target.value))} disabled={!ready} aria-label="Playback speed">
                    {(ready ? rates : [1]).map((r) => (
                      <option key={r} value={r}>
                        {r === 1 ? "Normal" : `${r}×`}
                      </option>
                    ))}
                  </select>
                </label>
                {!fullscreen && (
                  <button type="button" className={iconBtn} onClick={minimize} disabled={!activated} aria-label="Minimize to mini player" title="Mini player">
                    <Icon name="pip" />
                  </button>
                )}
                <button type="button" className={iconBtn} onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}>
                  <Icon name={fullscreen ? "shrink" : "expand"} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
