"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/toast";
import { formatBytes } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { LessonDTO, ResourceDTO } from "@/services/lessons";
import { Uploader, type UploadKind } from "./uploader";

export const RESOURCE_META: Record<ResourceDTO["kind"], { label: string; icon: IconName; tint: string }> = {
  pdf: { label: "PDF", icon: "file", tint: "bg-red-50 text-red-700" },
  slides: { label: "Slides", icon: "slides", tint: "bg-sun-50 text-sun-700" },
  document: { label: "Document", icon: "file", tint: "bg-brand-50 text-brand-700" },
  link: { label: "Link", icon: "link", tint: "bg-leaf-50 text-leaf-700" },
};

const FILE_KINDS: Array<{ kind: Exclude<UploadKind, "thumbnail" | "teacher_photo">; label: string; hint: string }> = [
  { kind: "pdf", label: "PDF", hint: ".pdf" },
  { kind: "slides", label: "Slides", hint: ".ppt, .pptx, .odp, .key" },
  { kind: "document", label: "Document / reading", hint: ".doc, .docx, .odt, .rtf, .txt, .xls, .xlsx, .csv" },
];

function resourceSubtitle(r: ResourceDTO) {
  if (r.kind === "link") {
    try {
      return new URL(r.url!).hostname;
    } catch {
      return r.url;
    }
  }
  return [r.format?.toUpperCase() ?? r.originalFilename?.split(".").pop()?.toUpperCase(), r.bytes !== undefined ? formatBytes(r.bytes) : null].filter(Boolean).join(" · ");
}

function ResourceRow({ courseId, lessonId, resource, canUpload, onChange }: { courseId: string; lessonId: string; resource: ResourceDTO; canUpload: boolean; onChange: (l: LessonDTO | null) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [url, setUrl] = useState(resource.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const base = `/api/teacher/courses/${courseId}/lessons/${lessonId}/resources/${resource.id}`;
  const meta = RESOURCE_META[resource.kind];

  async function save() {
    setBusy(true);
    setError(null);
    const res = await api<{ lesson: LessonDTO }>(base, { method: "PATCH", body: { title, ...(resource.kind === "link" ? { url } : {}) } });
    setBusy(false);
    if (!res.ok) return setError(res.error.fields?.url?.[0] ?? res.error.fields?.title?.[0] ?? res.error.message);
    setEditing(false);
    onChange(res.data.lesson);
    toast("Resource updated.");
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await api(base, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setConfirm(false);
    onChange(null);
    toast("Resource removed.");
  }

  return (
    <li className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        <span className={`flex size-10 items-center justify-center rounded-lg ${meta.tint}`}>
          <Icon name={meta.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input className="input py-2" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} aria-label="Resource title" />
              {resource.kind === "link" && <input className="input py-2" type="url" value={url} maxLength={2000} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL" placeholder="https://" />}
              {resource.kind !== "link" && canUpload && (
                <div className="rounded-lg bg-canvas p-2">
                  <p className="mb-1.5 text-xs text-muted">Replace the file (keeps this title and position):</p>
                  <Uploader
                    kind={resource.kind as Exclude<UploadKind, "thumbnail" | "teacher_photo">}
                    courseId={courseId}
                    lessonId={lessonId}
                    resourceId={resource.id}
                    label="Choose replacement file"
                    onDone={async () => {
                      const res = await api<{ lesson: LessonDTO }>(`/api/teacher/courses/${courseId}/lessons/${lessonId}`);
                      if (res.ok) onChange(res.data.lesson);
                      toast("File replaced.");
                      setEditing(false);
                    }}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-primary px-3 py-1.5" onClick={save} disabled={busy || !title.trim()}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-outline px-3 py-1.5"
                  onClick={() => {
                    setEditing(false);
                    setTitle(resource.title);
                    setUrl(resource.url ?? "");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate font-medium text-ink">{resource.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className={`badge px-2 py-0 ${meta.tint}`}>{meta.label}</span>
                <span className="truncate">{resourceSubtitle(resource)}</span>
              </p>
            </>
          )}
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-1">
            <a href={`/api/media/${lessonId}/${resource.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label={`Open ${resource.title}`} title="Open">
              <Icon name={resource.kind === "link" ? "external" : "eye"} />
            </a>
            <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" onClick={() => setEditing(true)} aria-label={`Edit ${resource.title}`} title="Edit">
              <Icon name="pencil" />
            </button>
            <button type="button" className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700" onClick={() => setConfirm(true)} aria-label={`Delete ${resource.title}`} title="Delete">
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} title="Remove this resource?" confirmLabel="Remove resource" busy={busy} error={error} onConfirm={remove} onCancel={() => setConfirm(false)}>
        <p>
          <strong>{resource.title}</strong> will be removed from this lesson{resource.kind !== "link" ? " and the file deleted from storage" : ""}. Students will no longer see it.
        </p>
      </ConfirmDialog>
    </li>
  );
}

/** Lesson resources. Every change here is saved immediately (independently of the lesson form). */
export function ResourceManager({ courseId, lesson, canUpload, onLessonChange }: { courseId: string; lesson: LessonDTO; canUpload: boolean; onLessonChange: (l: LessonDTO) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"file" | "link">(canUpload ? "file" : "link");
  const [fileKind, setFileKind] = useState<(typeof FILE_KINDS)[number]["kind"]>("pdf");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await api<{ lesson: LessonDTO }>(`/api/teacher/courses/${courseId}/lessons/${lesson.id}`);
    if (res.ok) onLessonChange(res.data.lesson);
  }

  async function addLink() {
    setBusy(true);
    setError(null);
    const res = await api<{ lesson: LessonDTO }>(`/api/teacher/courses/${courseId}/lessons/${lesson.id}/resources`, { body: { title, url } });
    setBusy(false);
    if (!res.ok) return setError(res.error.fields?.url?.[0] ?? res.error.fields?.title?.[0] ?? res.error.message);
    setTitle("");
    setUrl("");
    onLessonChange(res.data.lesson);
    toast("Link added.");
  }

  return (
    <div className="space-y-4">
      {lesson.resources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No resources yet. Add notes, slides, worksheets or reading links below.</p>
      ) : (
        <ul className="space-y-2">
          {lesson.resources.map((r) => (
            <ResourceRow
              key={`${r.id}:${r.title}:${r.bytes}:${r.url}`}
              courseId={courseId}
              lessonId={lesson.id}
              resource={r}
              canUpload={canUpload}
              onChange={(updated) => (updated ? onLessonChange(updated) : onLessonChange({ ...lesson, resources: lesson.resources.filter((x) => x.id !== r.id) }))}
            />
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-line bg-canvas p-4">
        <div className="mb-3 flex items-center gap-1 rounded-lg bg-white p-1 text-sm shadow-sm ring-1 ring-line" role="tablist" aria-label="Resource type">
          {(["file", "link"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={m === "file" && !canUpload}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition disabled:opacity-50 ${mode === m ? "bg-brand-600 text-white" : "text-ink hover:bg-brand-50"}`}
            >
              <Icon name={m === "file" ? "upload" : "link"} /> {m === "file" ? "Upload file" : "Add link"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="res-title" className="label">
              Resource title
            </label>
            <input id="res-title" className="input" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "file" ? "e.g. Chapter 1 lecture notes" : "e.g. NCTB textbook chapter"} />
          </div>
          {mode === "file" ? (
            <>
              <div>
                <span className="label">File type</span>
                <div className="flex flex-wrap gap-2">
                  {FILE_KINDS.map((k) => (
                    <button key={k.kind} type="button" onClick={() => setFileKind(k.kind)} aria-pressed={fileKind === k.kind} className={`badge cursor-pointer px-3 py-1 ${fileKind === k.kind ? "bg-brand-600 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50"}`}>
                      {k.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">Accepted: {FILE_KINDS.find((k) => k.kind === fileKind)!.hint}. Files are checked on the server before they are saved.</p>
              </div>
              <Uploader key={fileKind} kind={fileKind} courseId={courseId} lessonId={lesson.id} title={title} label="Choose file & upload" onDone={() => {
                setTitle("");
                toast("File uploaded.");
                refresh();
              }} />
            </>
          ) : (
            <>
              <div>
                <label htmlFor="res-url" className="label">
                  Link (https)
                </label>
                <input id="res-url" type="url" inputMode="url" className="input" value={url} maxLength={2000} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              </div>
              <button type="button" className="btn-leaf" onClick={addLink} disabled={busy || !title.trim() || !url.trim()}>
                <Icon name="plus" /> {busy ? "Adding…" : "Add link"}
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
