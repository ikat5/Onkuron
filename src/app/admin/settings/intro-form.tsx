"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { YouTubePreview } from "@/components/youtube-preview";
import { api } from "@/lib/api-client";
import { parseYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube";
import type { PlatformIntro } from "@/services/settings";

/** Edits the single platform introduction shown on the homepage. */
export function IntroForm({ initial }: { initial: PlatformIntro }) {
  const router = useRouter();
  const toast = useToast();
  const start = { url: initial.youtubeVideoId ? youtubeWatchUrl(initial.youtubeVideoId) : "", title: initial.title, text: initial.text };
  const [saved, setSaved] = useState(start);
  const [url, setUrl] = useState(start.url);
  const [title, setTitle] = useState(start.title);
  const [text, setText] = useState(start.text);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const id = parseYouTubeUrl(url);
  const invalid = url.trim() !== "" && !id;
  const dirty = url.trim() !== saved.url.trim() || title !== saved.title || text !== saved.text;

  async function save() {
    if (invalid) return setError("This isn't a YouTube video link. Copy it from YouTube's Share button.");
    setBusy(true);
    setError(null);
    const res = await api<{ intro: PlatformIntro }>("/api/teacher/settings/intro", { method: "PUT", body: { youtubeUrl: url.trim(), title: title.trim(), text: text.trim() } });
    setBusy(false);
    if (!res.ok) return setError(res.error.fields?.youtubeUrl?.[0] ?? res.error.fields?.text?.[0] ?? res.error.message);
    const next = { url: res.data.intro.youtubeVideoId ? youtubeWatchUrl(res.data.intro.youtubeVideoId) : "", title: res.data.intro.title, text: res.data.intro.text };
    setSaved(next);
    setUrl(next.url);
    setTitle(next.title);
    setText(next.text);
    toast("Introduction saved. It now shows on the homepage.");
    router.refresh();
  }

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="intro-url" className="label">
            YouTube video URL
          </label>
          <input
            id="intro-url"
            type="url"
            inputMode="url"
            className="input"
            value={url}
            maxLength={500}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtu.be/…"
            aria-invalid={invalid ? true : undefined}
            aria-describedby="intro-url-help"
          />
          <p id="intro-url-help" className={`mt-1 text-xs ${invalid ? "text-red-700" : "text-muted"}`}>
            {invalid ? "Not a valid YouTube video link (youtube.com/watch, youtu.be, /embed or /shorts)." : id ? `Video ID ${id} detected.` : "Leave empty to show a “coming soon” placeholder."}
          </p>
        </div>
        <div>
          <label htmlFor="intro-title" className="label">
            Heading
          </label>
          <input id="intro-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="intro-text" className="label">
            Description
          </label>
          <textarea id="intro-text" rows={6} className="input leading-relaxed" value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} />
          <p className="mt-1 text-right text-xs text-muted">{text.length}/1500</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save introduction"}
          </button>
          {dirty && <span className="text-xs font-semibold text-sun-700">● Unsaved changes</span>}
        </div>
      </div>
      <div>
        <p className="label">Preview</p>
        {id ? (
          <div className="overflow-hidden rounded-xl shadow-md">
            <YouTubePreview key={id} videoId={id} title={title || "Introduction"} />
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-canvas text-center text-sm text-muted">
            <Icon name={invalid ? "alert" : "video"} className={`size-8 ${invalid ? "text-red-500" : ""}`} />
            {invalid ? "No preview — the link isn't a valid YouTube video URL." : "Paste a YouTube link to preview it here."}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Use an Unlisted or Public video with embedding allowed.</p>
      </div>
    </form>
  );
}
