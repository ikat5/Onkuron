"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { PromoHero } from "@/components/home/promo-hero";
import { Icon } from "@/components/icons";
import { Uploader } from "@/components/teacher/uploader";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { parseYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube";
import type { PlatformIntro } from "@/services/settings";

type Draft = { url: string; title: string; text: string; enabled: boolean };
const draftOf = (i: PlatformIntro): Draft => ({ url: i.youtubeVideoId ? youtubeWatchUrl(i.youtubeVideoId) : "", title: i.title, text: i.text, enabled: i.enabled });

const CONFIRM = {
  video: { title: "Delete the promotional video?", label: "Delete video", url: "/api/teacher/settings/intro/video", body: "The homepage shows a “video coming soon” panel until you add a new one. An uploaded file is deleted from storage.", done: "Promotional video deleted." },
  poster: { title: "Remove poster image?", label: "Remove image", url: "/api/teacher/settings/intro/thumbnail", body: "The image will be deleted from storage and a frame of the video is shown instead.", done: "Poster image removed." },
} as const;

/**
 * Manages the homepage promotional video (the hero under the header): upload,
 * replace or delete a video file, or use a YouTube link instead, plus the
 * poster, heading and text. The preview renders the real hero with the
 * unsaved values. Render with `key` = the current video so an upload or
 * delete resets the form.
 */
export function PromoForm({ initial, canUpload }: { initial: PlatformIntro; canUpload: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(() => draftOf(initial));
  const [d, setD] = useState(() => draftOf(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<keyof typeof CONFIRM | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // The poster comes from fresh server data (router.refresh after upload), so unsaved edits survive an upload.
  const [removedThumb, setRemovedThumb] = useState<string | undefined>();
  const thumbnailUrl = initial.thumbnailUrl && initial.thumbnailUrl !== removedThumb ? initial.thumbnailUrl : undefined;

  const id = parseYouTubeUrl(d.url);
  const invalid = d.url.trim() !== "" && !id;
  const dirty = JSON.stringify({ ...d, url: d.url.trim() }) !== JSON.stringify({ ...saved, url: saved.url.trim() });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  // A typed YouTube link takes over from an uploaded file once saved; until then the file stays.
  const videoUrl = id ? undefined : initial.videoUrl;
  const hasVideo = Boolean(initial.videoUrl || initial.youtubeVideoId);

  async function save() {
    if (invalid) return setError("This isn't a YouTube video link. Copy it from YouTube's Share button.");
    if (d.title.trim().length === 0) return setError("Enter a heading for the hero.");
    setBusy(true);
    setError(null);
    const res = await api<{ intro: PlatformIntro }>("/api/teacher/settings/intro", { method: "PUT", body: { youtubeUrl: d.url.trim(), title: d.title.trim(), text: d.text.trim(), enabled: d.enabled } });
    setBusy(false);
    if (!res.ok) return setError(res.error.fields?.youtubeUrl?.[0] ?? res.error.fields?.text?.[0] ?? res.error.message);
    const next = draftOf(res.data.intro);
    setSaved(next);
    setD(next);
    toast(next.enabled ? "Promotional video published. The homepage shows it now." : "Saved. The video is hidden on the homepage.");
    router.refresh();
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    const res = await api(CONFIRM[confirm].url, { method: "DELETE" });
    setConfirmBusy(false);
    if (!res.ok) return toast(res.error.message, "error");
    if (confirm === "poster") setRemovedThumb(thumbnailUrl);
    toast(CONFIRM[confirm].done);
    setConfirm(null);
    router.refresh();
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-ink">Video</h2>
        <p className="mb-5 text-sm text-muted">Upload a video file, or use a YouTube link. Only one is shown at a time.</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${hasVideo ? "bg-leaf-50 text-leaf-700" : "bg-slate-100 text-slate-500"}`}>
                <Icon name={hasVideo ? "video" : "play"} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{initial.videoUrl ? "Uploaded video file" : initial.youtubeVideoId ? "YouTube video" : "No video yet"}</p>
                <p className="text-xs text-muted">{hasVideo ? "Live on the homepage hero." : "The homepage shows a “video coming soon” panel."}</p>
              </div>
              {hasVideo && (
                <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => setConfirm("video")}>
                  Delete video
                </button>
              )}
            </div>
            {!canUpload ? (
              <p className="text-xs text-sun-700">Video uploads are unavailable until Cloudinary is configured. You can still use a YouTube link.</p>
            ) : (
              <div>
                <Uploader kind="promo_video" label={initial.videoUrl ? "Replace video file" : "Upload video file"} onDone={() => router.refresh()} />
                <p className="mt-1 text-xs text-muted">MP4, WebM or MOV. Uploading a file replaces the current video, including a YouTube link.</p>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="promo-url" className="label">
              Or use a YouTube link
            </label>
            <input
              id="promo-url"
              type="url"
              inputMode="url"
              className="input"
              value={d.url}
              maxLength={500}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://youtu.be/…"
              aria-invalid={invalid ? true : undefined}
              aria-describedby="promo-url-help"
            />
            <p id="promo-url-help" className={`mt-1 text-xs ${invalid ? "text-red-700" : "text-muted"}`}>
              {invalid
                ? "Not a valid YouTube video link (youtube.com/watch, youtu.be, /embed or /shorts)."
                : id
                  ? `Video ID ${id} detected. Use a Public or Unlisted video with embedding allowed.${initial.videoUrl ? " Saving replaces the uploaded file." : ""}`
                  : "Paste a link and press “Save & publish”."}
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-ink">Text and poster</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3">
              <input type="checkbox" className="mt-1 size-4 accent-leaf-600" checked={d.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-ink">Show the video on the homepage</span>
                <span className="text-xs text-muted">When off, the hero shows only the heading, text and buttons.</span>
              </span>
            </label>
            <div>
              <label htmlFor="promo-title" className="label">
                Heading <span className="text-red-600">*</span>
              </label>
              <input id="promo-title" className="input" value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="promo-text" className="label">
                  Supporting text
                </label>
                <span className="text-xs text-muted">{d.text.length}/1500</span>
              </div>
              <textarea id="promo-text" rows={4} className="input leading-relaxed" value={d.text} maxLength={1500} onChange={(e) => set("text", e.target.value)} />
              <p className="mt-1 text-xs text-muted">The homepage shows up to four lines; keep it to two or three sentences.</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="label">Poster image (optional)</p>
            <p className="text-sm text-muted">Shown on the player until the visitor presses play. Without one, a frame of the video (or YouTube&apos;s thumbnail) is used.</p>
            {!canUpload ? (
              <p className="text-xs text-sun-700">Uploads are unavailable until Cloudinary is configured.</p>
            ) : (
              <>
                <Uploader kind="promo_thumbnail" label={thumbnailUrl ? "Replace poster image" : "Upload poster image"} onDone={() => router.refresh()} />
                <p className="text-xs text-muted">16:9 JPG, PNG or WebP, at least 1280×720.</p>
                {thumbnailUrl && (
                  <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => setConfirm("poster")}>
                    Remove poster image
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy || !dirty}>
          {busy ? "Publishing…" : "Save & publish"}
        </button>
        <span className="text-xs" aria-live="polite">
          {dirty ? <span className="font-semibold text-sun-700">● Unsaved changes — the preview below shows them</span> : <span className="text-muted">The homepage matches the preview.</span>}
        </span>
      </div>

      <div>
        <p className="label flex items-center gap-2">
          <Icon name="eye" /> Live preview
        </p>
        <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
          <PromoHero preview intro={{ youtubeVideoId: id ?? undefined, videoUrl, title: d.title || "Heading", text: d.text, enabled: d.enabled, thumbnailUrl }} />
        </div>
      </div>

      <ConfirmDialog open={confirm !== null} title={confirm ? CONFIRM[confirm].title : ""} confirmLabel={confirm ? CONFIRM[confirm].label : ""} busy={confirmBusy} onConfirm={runConfirm} onCancel={() => setConfirm(null)}>
        <p>{confirm && CONFIRM[confirm].body}</p>
      </ConfirmDialog>
    </form>
  );
}
