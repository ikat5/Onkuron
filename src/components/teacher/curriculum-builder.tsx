"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { youtubeThumbnail } from "@/lib/youtube";
import type { LessonDTO } from "@/services/lessons";
import { LessonEditor } from "./lesson-editor";

function VideoThumb({ lesson }: { lesson: LessonDTO }) {
  if (lesson.youtubeVideoId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-brand-900 sm:w-40">
        <Image src={youtubeThumbnail(lesson.youtubeVideoId, "mqdefault")} alt="" fill unoptimized sizes="160px" className="object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white">
            <Icon name="play" className="ml-0.5 size-4" />
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className={`flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs sm:w-40 ${lesson.legacyVideo ? "border-sun-100 bg-sun-50 text-sun-700" : "border-line bg-canvas text-muted"}`}>
      <Icon name="video" className="size-5" />
      {lesson.legacyVideo ? "Uploaded video" : "No video yet"}
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  total,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  lesson: LessonDTO;
  index: number;
  total: number;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const files = lesson.resources.filter((r) => r.kind !== "link").length;
  const links = lesson.resources.length - files;
  return (
    <li className="card group flex flex-col gap-4 p-4 transition hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:contents">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700" aria-label={`Lesson ${index + 1}`}>
          {index + 1}
        </span>
        <div className="flex-1 sm:hidden">
          <p className="font-semibold text-ink">{lesson.title}</p>
        </div>
      </div>
      <button type="button" onClick={onEdit} className="sm:shrink-0" aria-label={`Edit video for ${lesson.title}`}>
        <VideoThumb lesson={lesson} />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="hidden text-left font-semibold text-ink hover:text-brand-700 sm:block">
          {lesson.title}
        </button>
        {lesson.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{lesson.description}</p> : <p className="mt-0.5 text-sm text-muted/70 italic">No description</p>}
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {lesson.youtubeVideoId ? (
            <span className="badge gap-1 bg-leaf-50 text-leaf-700">
              <Icon name="check" className="size-3" /> YouTube video
            </span>
          ) : lesson.legacyVideo ? (
            <span className="badge gap-1 bg-sun-50 text-sun-700">Legacy upload — replace with YouTube</span>
          ) : (
            <span className="badge gap-1 bg-sun-50 text-sun-700">
              <Icon name="alert" className="size-3" /> Video missing
            </span>
          )}
          <span className="badge gap-1 bg-brand-50 text-brand-700">
            <Icon name="file" className="size-3" /> {files} file{files === 1 ? "" : "s"}
            {links > 0 && ` · ${links} link${links === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-line pt-3 sm:border-0 sm:pt-0">
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => onMove(-1)} disabled={busy || index === 0} aria-label={`Move ${lesson.title} up`} title="Move up">
          <Icon name="up" />
        </button>
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => onMove(1)} disabled={busy || index === total - 1} aria-label={`Move ${lesson.title} down`} title="Move down">
          <Icon name="down" />
        </button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <button type="button" className="btn-outline px-3 py-1.5" onClick={onEdit}>
          <Icon name="pencil" /> Edit
        </button>
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700" onClick={onDelete} aria-label={`Delete ${lesson.title}`} title="Delete lesson">
          <Icon name="trash" />
        </button>
      </div>
    </li>
  );
}

export function CurriculumBuilder({ courseId, initialLessons, canUpload }: { courseId: string; initialLessons: LessonDTO[]; canUpload: boolean }) {
  const router = useRouter();
  const toast = useToast();
  // Local state is authoritative after mount: every mutation returns the updated lesson(s).
  const [lessons, setLessons] = useState(initialLessons);
  const [editor, setEditor] = useState<{ key: number; lessonId?: string } | null>(null);
  const [deleting, setDeleting] = useState<LessonDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const editing = editor?.lessonId ? lessons.find((l) => l.id === editor.lessonId) : undefined;
  const editingNumber = editing ? lessons.indexOf(editing) + 1 : lessons.length + 1;
  const withVideo = lessons.filter((l) => l.youtubeVideoId || l.legacyVideo).length;
  const resourceCount = lessons.reduce((n, l) => n + l.resources.length, 0);

  function upsert(lesson: LessonDTO) {
    setLessons((ls) => (ls.some((l) => l.id === lesson.id) ? ls.map((l) => (l.id === lesson.id ? lesson : l)) : [...ls, lesson]));
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= lessons.length) return;
    const before = lessons;
    const next = [...lessons];
    [next[index], next[target]] = [next[target], next[index]];
    setLessons(next);
    setReordering(true);
    const res = await api<{ lessons: LessonDTO[] }>(`/api/teacher/courses/${courseId}/lessons/order`, { method: "PUT", body: { lessonIds: next.map((l) => l.id) } });
    setReordering(false);
    if (res.ok) setLessons(res.data.lessons);
    else {
      setLessons(before);
      toast(res.error.message, "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await api(`/api/teacher/courses/${courseId}/lessons/${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (!res.ok) return setDeleteError(res.error.message);
    setLessons((ls) => ls.filter((l) => l.id !== deleting.id).map((l, order) => ({ ...l, order })));
    toast(`“${deleting.title}” deleted.`);
    setDeleting(null);
    router.refresh();
  }

  return (
    <section id="curriculum" aria-labelledby="curriculum-title" className="scroll-mt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="curriculum-title" className="text-xl font-bold text-brand-700">
            Curriculum
          </h2>
          <p className="text-sm text-muted">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"} · {withVideo} with video · {resourceCount} resource{resourceCount === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="btn-leaf px-5 py-3" onClick={() => setEditor({ key: Date.now() })}>
          <Icon name="plus" className="size-5" /> Add lesson
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
            <Icon name="video" className="size-7" />
          </span>
          <p className="text-lg font-semibold text-ink">Build your curriculum</p>
          <p className="mt-1 max-w-md text-sm text-muted">Add lessons one by one: a title, a short description, the YouTube video link and any notes or slides students need.</p>
          <button type="button" className="btn-leaf mt-5" onClick={() => setEditor({ key: Date.now() })}>
            <Icon name="plus" /> Add your first lesson
          </button>
        </div>
      ) : (
        <ol className="space-y-3" aria-busy={reordering}>
          {lessons.map((l, i) => (
            <LessonRow
              key={l.id}
              lesson={l}
              index={i}
              total={lessons.length}
              busy={reordering}
              onEdit={() => setEditor({ key: Date.now(), lessonId: l.id })}
              onDelete={() => {
                setDeleteError(null);
                setDeleting(l);
              }}
              onMove={(dir) => move(i, dir)}
            />
          ))}
          <li>
            <button type="button" onClick={() => setEditor({ key: Date.now() })} className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line py-4 text-sm font-semibold text-brand-600 transition hover:border-brand-200 hover:bg-brand-50">
              <Icon name="plus" /> Add lesson {lessons.length + 1}
            </button>
          </li>
        </ol>
      )}

      {editor && (
        <LessonEditor
          key={editor.key}
          open
          courseId={courseId}
          lesson={editing}
          lessonNumber={editingNumber}
          canUpload={canUpload}
          onSaved={(lesson, created) => {
            upsert(lesson);
            if (created) setEditor((e) => (e ? { ...e, lessonId: lesson.id } : e));
            router.refresh();
          }}
          onClose={() => setEditor(null)}
        />
      )}

      <ConfirmDialog open={Boolean(deleting)} title="Delete this lesson?" confirmLabel="Delete lesson" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        <p>
          <strong>{deleting?.title}</strong> and its {deleting?.resources.length ?? 0} resource(s) will be permanently removed. The remaining lessons are renumbered.
        </p>
        <p className="text-muted">Students&apos; progress on this lesson is removed too; their progress on other lessons is not affected. The YouTube video itself stays on YouTube.</p>
      </ConfirmDialog>
    </section>
  );
}
