/**
 * YouTube URL handling shared by the browser (live preview) and the server
 * (authoritative validation). Only a video ID extracted from a recognised
 * YouTube host is ever stored; the client never sends an ID directly.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const EMBED_HOSTS = new Set([...WATCH_HOSTS, "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

/** Path prefixes on youtube.com whose next segment is the video ID. */
const PATH_FORMS = ["embed", "shorts", "live", "v"];

export const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

export function isYouTubeId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** Returns the 11-character video ID, or null if the input is not a recognised YouTube video URL. */
export function parseYouTubeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 500) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  let id: string | null | undefined;
  if (SHORT_HOSTS.has(host)) {
    id = segments.length === 1 ? segments[0] : null;
  } else if (WATCH_HOSTS.has(host) && segments.length === 1 && segments[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (EMBED_HOSTS.has(host) && segments.length === 2 && PATH_FORMS.includes(segments[0])) {
    id = segments[1];
  }
  return isYouTubeId(id) ? id : null;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnail(id: string, size: "mqdefault" | "hqdefault" | "maxresdefault" = "hqdefault") {
  return `https://i.ytimg.com/vi/${id}/${size}.jpg`;
}

/** Privacy-enhanced embed URL for the click-to-load preview (no JS API). */
export function youtubeEmbedUrl(id: string, opts: { autoplay?: boolean; origin?: string } = {}) {
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (opts.autoplay) params.set("autoplay", "1");
  if (opts.origin) params.set("origin", opts.origin);
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${id}?${params}`;
}
