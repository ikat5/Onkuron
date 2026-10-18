"use client";

import Link from "next/link";
import { useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { Icon } from "@/components/icons";
import { CourseHeader } from "@/components/learn/course-header";
import { LessonPlayer, formatTime } from "@/components/learn/lesson-player";
import { useToast } from "@/components/toast";
import { formatBytes } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { LessonDTO, ResourceDTO } from "@/services/lessons";
import type { ProgressDTO } from "@/services/progress";

const RESOURCE_META: Record<ResourceDTO["kind"], { label: string; icon: "file" | "slides" | "link"; tint: string }> = {
  pdf: { label: "PDF", icon: "file", tint: "bg-red-50 text-red-700" },
  slides: { label: "Slides", icon: "slides", tint: "bg-sun-50 text-sun-700" },
  document: { label: "Document", icon: "file", tint: "bg-brand-50 text-brand-700" },
  link: { label: "Link", icon: "link", tint: "bg-leaf-50 text-leaf-700" },
};

function hostOf(url?: string) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function ResourceCard({ lessonId, r }: { lessonId: string; r: ResourceDTO }) {
  const meta = RESOURCE_META[r.kind];
  const detail = r.kind === "link" ? hostOf(r.url) : [r.format?.toUpperCase(), r.bytes !== undefined ? formatBytes(r.bytes) : null].filter(Boolean).join(" · ");
  return (
    // Files and links go through an enrollment-checked redirect.
    <a href={`/api/media/${lessonId}/${r.id}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm transition hover:border-brand-200 hover:shadow-sm">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}>
        <Icon name={meta.icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink group-hover:text-brand-700">{r.title}</span>
        <span className="text-xs text-muted">
          {meta.label}
          {detail && ` · ${detail}`}
        </span>
      </span>
      <span className="flex items-center gap-1 rounded-lg bg-canvas px-2.5 py-1.5 text-xs font-semibold text-brand-700 group-hover:bg-brand-50">
        <Icon name={r.kind === "link" ? "external" : "eye"} className="size-3.5" /> {r.kind === "link" ? "Visit" : "Open"}
      </span>
    </a>
  );
}

export function LessonView({
  course,
  lessons,
  initialProgress,
  currentId,
  role,
  conversationId,
}: {
  course: { id: string; title: string; slug: string };
  lessons: LessonDTO[];
  initialProgress: ProgressDTO[];
  currentId: string;
  role: "student" | "teacher";
  conversationId?: string;
}) {
  const toast = useToast();
  const [progress, setProgress] = useState<Record<string, ProgressDTO>>(() => Object.fromEntries(initialProgress.map((p) => [p.lessonId, p])));
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const index = Math.max(0, lessons.findIndex((l) => l.id === currentId));
  const lesson = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const p = progress[lesson.id];
  const isStudent = role === "student";
  const completedCount = lessons.filter((l) => progress[l.id]?.completed).length;
  const otherResources = lessons.filter((l) => l.id !== lesson.id && l.resources.length > 0);
  // Resume where the student left off, unless they had (nearly) finished.
  const resumeAt = p && p.positionSeconds > 5 && (!p.durationSeconds || p.positionSeconds < p.durationSeconds - 15) ? p.positionSeconds : 0;
  const href = (id: string) => `/learn/${course.slug}/${id}`;

  function update(dto: ProgressDTO) {
    setProgress((all) => {
      if (!all[dto.lessonId]?.completed && dto.completed) toast("Lesson completed — nice work! 🌱");
      return { ...all, [dto.lessonId]: dto };
    });
  }

  async function toggleComplete() {
    setBusy(true);
    const res = await api<{ progress: ProgressDTO }>(`/api/learn/lessons/${lesson.id}/progress`, { body: { completed: !p?.completed } });
    setBusy(false);
    if (res.ok) {
      if (p?.completed) toast("Marked as not complete.", "info");
      update(res.data.progress);
    } else toast(res.error.message, "error");
  }

  return (
    <>
      <CourseHeader title={course.title} backHref={`/learn/${course.slug}`} backLabel="All lessons" completed={completedCount} total={lessons.length} teacherPreview={!isStudent} />

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <LessonPlayer
          key={`${lesson.id}:${lesson.videoKey}`}
          lessonId={lesson.id}
          title={lesson.title}
          youtubeVideoId={lesson.youtubeVideoId}
          legacySrc={!lesson.youtubeVideoId && lesson.legacyVideo ? `/api/media/${lesson.id}` : undefined}
          videoKey={lesson.videoKey}
          resumeAt={resumeAt}
          track={isStudent}
          onProgress={update}
          onEnded={() => setEnded(lesson.id)}
        />

        {ended === lesson.id && next && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-leaf-100 bg-leaf-50 p-4 text-sm" role="status">
            <span className="font-semibold text-leaf-700">Up next:</span>
            <span className="flex-1 text-ink">{next.title}</span>
            <Link href={href(next.id)} className="btn-leaf px-3 py-1.5">
              Next lesson <Icon name="right" />
            </Link>
          </div>
        )}

        <article className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Lesson {index + 1} of {lessons.length}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{lesson.title}</h2>
              {isStudent && p && !p.completed && p.percent > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <Icon name="clock" className="size-3.5" /> {p.percent}% watched{p.durationSeconds ? ` of ${formatTime(p.durationSeconds)}` : ""} · completes automatically at 90%
                </p>
              )}
            </div>
            {isStudent && (
              <button
                type="button"
                onClick={toggleComplete}
                disabled={busy}
                aria-pressed={Boolean(p?.completed)}
                className={p?.completed ? "btn shrink-0 border border-leaf-100 bg-leaf-50 text-leaf-700 hover:bg-leaf-100" : "btn-leaf shrink-0"}
              >
                <Icon name="check" /> {busy ? "Saving…" : p?.completed ? "Completed" : "Mark as complete"}
              </button>
            )}
          </div>
          {lesson.description && <p className="mt-4 leading-relaxed whitespace-pre-line text-ink">{lesson.description}</p>}
        </article>

        <section aria-labelledby="resources-title" className="card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="resources-title" className="text-lg font-semibold text-ink">
              Lesson resources
            </h2>
            <span className="text-sm text-muted">{lesson.resources.length} item{lesson.resources.length === 1 ? "" : "s"}</span>
          </div>
          {lesson.resources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">This lesson has no notes or files.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {lesson.resources.map((r) => (
                <li key={r.id}>
                  <ResourceCard lessonId={lesson.id} r={r} />
                </li>
              ))}
            </ul>
          )}

          {otherResources.length > 0 && (
            <details className="group mt-6 border-t border-line pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-brand-700">
                <Icon name="right" className="size-4 transition group-open:rotate-90" />
                Resources from other lessons ({otherResources.reduce((n, l) => n + l.resources.length, 0)})
              </summary>
              <div className="mt-4 space-y-5">
                {otherResources.map((l) => (
                  <div key={l.id}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                      Lesson {lessons.indexOf(l) + 1} · {l.title}
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {l.resources.map((r) => (
                        <li key={r.id}>
                          <ResourceCard lessonId={l.id} r={r} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        <nav aria-label="Lesson navigation" className="grid grid-cols-2 gap-3">
          {prev ? (
            <Link href={href(prev.id)} className="card flex items-center gap-2 p-4 text-sm hover:border-brand-200">
              <Icon name="left" className="size-5 text-brand-600" />
              <span className="min-w-0">
                <span className="block text-xs text-muted">Previous lesson</span>
                <span className="block truncate font-medium text-ink">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <Link href={`/learn/${course.slug}`} className="card flex items-center gap-2 p-4 text-sm hover:border-brand-200">
              <Icon name="left" className="size-5 text-brand-600" />
              <span className="font-medium text-ink">All lessons</span>
            </Link>
          )}
          {next ? (
            <Link href={href(next.id)} className="card flex items-center justify-end gap-2 p-4 text-right text-sm hover:border-brand-200">
              <span className="min-w-0">
                <span className="block text-xs text-muted">Next lesson</span>
                <span className="block truncate font-medium text-ink">{next.title}</span>
              </span>
              <Icon name="right" className="size-5 text-brand-600" />
            </Link>
          ) : (
            <Link href={`/learn/${course.slug}`} className="card flex items-center justify-end gap-2 p-4 text-sm hover:border-brand-200">
              <span className="font-medium text-ink">Back to all lessons</span>
              <Icon name="right" className="size-5 text-brand-600" />
            </Link>
          )}
        </nav>

        {isStudent && conversationId ? (
          <section className="card overflow-hidden" aria-labelledby="ask-title">
            <div className="flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-sun-50 text-sun-600">
                <Icon name="chat" className="size-5" />
              </span>
              <div className="flex-1">
                <h2 id="ask-title" className="text-sm font-semibold text-ink">
                  Stuck on something?
                </h2>
                <p className="text-xs text-muted">Ask your teacher about this lesson.</p>
              </div>
              <button type="button" className={chatOpen ? "btn-outline px-3 py-1.5" : "btn-sun px-3 py-1.5"} onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen}>
                {chatOpen ? "Hide" : "Ask"}
              </button>
            </div>
            {chatOpen && (
              <div className="border-t border-line">
                <ChatPanel conversationId={conversationId} otherLabel="Onkuron Teacher" heightClass="h-96 rounded-none border-0 shadow-none" context={{ courseId: course.id, lessonId: lesson.id, label: `${course.title} · ${lesson.title}` }} />
              </div>
            )}
          </section>
        ) : (
          !isStudent && (
            <Link href="/admin/messages" className="card flex items-center gap-3 p-4 text-sm hover:border-brand-200">
              <Icon name="chat" className="size-5 text-sun-600" /> Student questions appear in Messages
            </Link>
          )
        )}
      </div>
    </>
  );
}
