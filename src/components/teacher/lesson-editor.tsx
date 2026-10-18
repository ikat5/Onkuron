"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { YouTubePreview } from "@/components/youtube-preview";
import { api } from "@/lib/api-client";
import { parseYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube";
import type { LessonDTO } from "@/services/lessons";
import { ResourceManager } from "./resource-manager";

interface Draft {
  title: string;
  description: string;
  youtubeUrl: string;
}

const draftOf = (l?: LessonDTO): Draft => ({
  title: l?.title ?? "",
  description: l?.description ?? "",
  youtubeUrl: l?.youtubeVideoId ? youtubeWatchUrl(l.youtubeVideoId) : "",
});

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="relative pl-10">
      <span className="absolute top-0 left-0 flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <h3 className="font-semibold text-ink">{title}</h3>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

/**
 * Side-panel editor for one lesson. Title, description and video are saved
 * together; resources are saved one by one as they are added (which needs
 * the lesson to exist, so a new lesson is saved first).
 */
export function LessonEditor({
  open,
  courseId,
  lesson,
  lessonNumber,
  canUpload,
  onSaved,
  onClose,
}: {
  open: boolean;
  courseId: string;
  lesson?: LessonDTO;
  lessonNumber: number;
  canUpload: boolean;
  onSaved: (lesson: LessonDTO, created: boolean) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState<LessonDTO | undefined>(lesson);
  const [saved, setSaved] = useState<Draft>(draftOf(lesson));
  const [draft, setDraft] = useState<Draft>(draftOf(lesson));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);

  const dirty = draft.title !== saved.title || draft.description !== saved.description || draft.youtubeUrl.trim() !== saved.youtubeUrl.trim();
  const videoId = parseYouTubeUrl(draft.youtubeUrl);
  const urlInvalid = draft.youtubeUrl.trim() !== "" && !videoId;
  const showUrlError = urlInvalid && (urlTouched || draft.youtubeUrl.length > 15);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setConfirmDiscard(false);
  }

  function requestClose() {
    if (dirty && !confirmDiscard) return setConfirmDiscard(true);
    onClose();
  }

  async function save(closeAfter: boolean) {
    const found: typeof errors = {};
    if (draft.title.trim().length < 2) found.title = "Give the lesson a title (at least 2 characters)";
    if (urlInvalid) found.youtubeUrl = "This isn't a YouTube video link. Copy the link from YouTube's Share button.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      setUrlTouched(true);
      document.getElementById(found.title ? "l-title" : "l-youtube")?.focus();
      return;
    }
    setBusy(true);
    const body = { title: draft.title.trim(), description: draft.description.trim(), youtubeUrl: draft.youtubeUrl.trim() };
    const res = current
      ? await api<{ lesson: LessonDTO }>(`/api/teacher/courses/${courseId}/lessons/${current.id}`, { method: "PATCH", body })
      : await api<{ lesson: LessonDTO }>(`/api/teacher/courses/${courseId}/lessons`, { body });
    setBusy(false);
    if (!res.ok) {
      const f = res.error.fields;
      if (f) setErrors({ title: f.title?.[0], description: f.description?.[0], youtubeUrl: f.youtubeUrl?.[0] });
      else setFormError(res.error.message);
      return;
    }
    const created = !current;
    const next = draftOf(res.data.lesson);
    setCurrent(res.data.lesson);
    setSaved(next);
    setDraft(next);
    setConfirmDiscard(false);
    onSaved(res.data.lesson, created);
    toast(created ? `Lesson ${lessonNumber} added to the curriculum.` : "Lesson saved.");
    if (closeAfter) onClose();
  }

  return (
    <Dialog
      open={open}
      variant="panel"
      onRequestClose={requestClose}
      labelledBy="lesson-editor-title"
      title={current ? `Edit lesson ${lessonNumber}` : `New lesson ${lessonNumber}`}
      description={current ? current.title : "Add the details, paste the YouTube link, then attach resources."}
      footer={
        <>
          {confirmDiscard ? (
            <p className="mr-auto flex items-center gap-2 text-sm text-sun-700" role="alert">
              <Icon name="alert" /> Unsaved changes will be lost.
              <button type="button" className="font-semibold underline" onClick={onClose}>
                Discard
              </button>
            </p>
          ) : (
            dirty && <p className="mr-auto text-xs font-semibold text-sun-700">● Unsaved changes</p>
          )}
          <button type="button" className="btn-outline" onClick={requestClose} disabled={busy}>
            {dirty ? "Cancel" : "Close"}
          </button>
          <button type="button" className="btn-outline" onClick={() => save(false)} disabled={busy || (!dirty && Boolean(current))}>
            Save
          </button>
          <button type="button" className="btn-primary" onClick={() => save(true)} disabled={busy || (!dirty && Boolean(current))}>
            {busy ? "Saving…" : "Save & close"}
          </button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}

        <Step n={1} title="Lesson title">
          <input
            id="l-title"
            className="input text-base"
            value={draft.title}
            maxLength={150}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Newton's first law"
            aria-label="Lesson title"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "l-title-err" : undefined}
            autoFocus
          />
          {errors.title && (
            <p id="l-title-err" className="mt-1 text-xs text-red-700">
              {errors.title}
            </p>
          )}
        </Step>

        <Step n={2} title="Lesson description" hint="What the lesson covers and what students should do. Shown under the video.">
          <textarea
            id="l-description"
            className="input leading-relaxed"
            rows={5}
            maxLength={5000}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            aria-label="Lesson description"
          />
          <p className="mt-1 text-right text-xs text-muted">{draft.description.length}/5000</p>
        </Step>

        <Step n={3} title="YouTube video URL" hint="Upload the video to the platform's YouTube channel (Unlisted), then paste its link here.">
          <div className="flex items-center rounded-lg border border-line bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 has-[[aria-invalid=true]]:border-red-400">
            <span className="pl-3 text-red-600">
              <Icon name="video" className="size-5" />
            </span>
            <input
              id="l-youtube"
              type="url"
              inputMode="url"
              className="w-full rounded-lg bg-transparent px-2 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none"
              value={draft.youtubeUrl}
              maxLength={500}
              onChange={(e) => set("youtubeUrl", e.target.value)}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…"
              aria-label="YouTube video URL"
              aria-invalid={showUrlError || errors.youtubeUrl ? true : undefined}
              aria-describedby="l-youtube-help"
            />
            {draft.youtubeUrl && (
              <button type="button" className="mr-1 rounded-md p-1.5 text-muted hover:bg-brand-50 hover:text-ink" onClick={() => set("youtubeUrl", "")} aria-label="Clear video URL">
                <Icon name="x" />
              </button>
            )}
          </div>
          <p id="l-youtube-help" className={`mt-1 text-xs ${showUrlError || errors.youtubeUrl ? "text-red-700" : "text-muted"}`}>
            {errors.youtubeUrl ??
              (showUrlError
                ? "This isn't a YouTube video link. Accepted: youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…, youtube.com/shorts/…"
                : videoId
                  ? `Video ID ${videoId} detected.`
                  : "Leave empty if the video isn't ready yet. You can add it later.")}
          </p>
        </Step>

        <Step n={4} title="Video preview">
          {videoId ? (
            <>
              <YouTubePreview key={videoId} videoId={videoId} title={draft.title || "Lesson video"} />
              <p className="mt-2 text-xs text-muted">
                Check that this is the right video and that it plays. Videos set to <strong>Private</strong> or with embedding disabled won&apos;t play for students.
              </p>
            </>
          ) : current?.legacyVideo && !draft.youtubeUrl ? (
            <div className="flex items-start gap-3 rounded-xl border border-sun-100 bg-sun-50 p-4 text-sm text-sun-700">
              <Icon name="alert" className="mt-0.5 size-5" />
              <p>
                This lesson still uses an older uploaded video ({current.legacyVideo.originalFilename ?? "video file"}). Paste a YouTube link to replace it — the old file is then deleted to free storage.
              </p>
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-canvas text-center text-sm text-muted">
              <Icon name={urlInvalid ? "alert" : "video"} className={`size-8 ${urlInvalid ? "text-red-500" : ""}`} />
              {urlInvalid ? "No preview — the link isn't a valid YouTube video URL." : "Paste a YouTube link to see the preview."}
            </div>
          )}
        </Step>

        <Step n={5} title="Learning resources" hint="Notes, slides, worksheets and reading links. Changes here are saved immediately.">
          {current ? (
            <ResourceManager
              courseId={courseId}
              lesson={current}
              canUpload={canUpload}
              onLessonChange={(l) => {
                setCurrent(l);
                onSaved(l, false);
              }}
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-canvas p-4 text-sm text-muted">
              <Icon name="file" className="size-5" />
              <span>Save the lesson first, then attach resources here.</span>
              <button type="button" className="btn-leaf ml-auto px-3 py-1.5 text-xs" onClick={() => save(false)} disabled={busy}>
                Save lesson
              </button>
            </div>
          )}
        </Step>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Save
        </button>
      </form>
    </Dialog>
  );
}
