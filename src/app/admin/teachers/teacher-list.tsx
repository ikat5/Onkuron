"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import type { TeacherProfileDTO } from "@/services/teacher-profile";

export function TeacherList({ initial }: { initial: TeacherProfileDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [teachers, setTeachers] = useState(initial);
  const [deleting, setDeleting] = useState<TeacherProfileDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= teachers.length) return;
    const before = teachers;
    const next = [...teachers];
    [next[i], next[j]] = [next[j], next[i]];
    setTeachers(next);
    const res = await api<{ teachers: TeacherProfileDTO[] }>("/api/teacher/teachers/order", { method: "PUT", body: { profileIds: next.map((t) => t.id) } });
    if (res.ok) setTeachers(res.data.teachers);
    else {
      setTeachers(before);
      toast(res.error.message, "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/teacher/teachers/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setTeachers((ts) => ts.filter((t) => t.id !== deleting.id));
    toast(`${deleting.displayName} removed.`);
    setDeleting(null);
    router.refresh();
  }

  if (teachers.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
          <Icon name="user" className="size-8" />
        </span>
        <p className="mt-4 text-lg font-bold text-ink">No teachers yet</p>
        <p className="mt-1 max-w-md text-sm text-muted">Add each teacher with a photo, biography, subjects and achievements. Published teachers appear on Meet Our Teachers and the student dashboard.</p>
        <Link href="/admin/teachers/new" className="btn-leaf mt-5">
          <Icon name="plus" /> Add your first teacher
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        {teachers.map((t, i) => (
          <li key={t.id} className="card lift group flex flex-col overflow-hidden hover:border-brand-200">
            <Link href={`/admin/teachers/${t.id}`} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-600 to-night-800" aria-label={`Edit ${t.displayName}`}>
              {t.photoUrl ? (
                <Image src={t.photoUrl} alt="" fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <span className="flex h-full items-center justify-center font-display text-6xl font-extrabold text-white/85">{t.displayName.slice(0, 1).toUpperCase()}</span>
              )}
              <span className={`absolute top-3 left-3 badge ${t.published ? "bg-leaf-600 text-white" : "bg-white/90 text-ink"}`}>{t.published ? "Published" : "Draft"}</span>
              <span className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-white text-brand-700 shadow-lg transition group-hover:bg-sun-500 group-hover:text-ink">
                <Icon name="pencil" className="size-4" />
              </span>
            </Link>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-lg font-extrabold text-ink">{t.displayName}</p>
              {t.headline && <p className="text-sm font-semibold text-brand-600">{t.headline}</p>}
              {t.shortBio && <p className="mt-2 line-clamp-2 text-sm text-muted">{t.shortBio}</p>}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span>{t.subjects.length ? t.subjects.slice(0, 3).join(" · ") : "No subjects yet"}</span>
                <span>
                  {t.courseIds.length} course{t.courseIds.length === 1 ? "" : "s"}
                </span>
              </p>
              <div className="mt-auto flex items-center gap-1 border-t border-line pt-3">
                <Link href={`/admin/teachers/${t.id}`} className="btn-primary px-3 py-1.5">
                  <Icon name="pencil" /> Edit
                </Link>
                <Link href={`/admin/teachers/${t.id}/preview`} className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label={`Preview ${t.displayName}`} title="Preview">
                  <Icon name="eye" />
                </Link>
                <span className="ml-auto flex items-center">
                  <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.displayName} earlier`} title="Move earlier">
                    <Icon name="left" />
                  </button>
                  <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === teachers.length - 1} aria-label={`Move ${t.displayName} later`} title="Move later">
                    <Icon name="right" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setError(null);
                      setDeleting(t);
                    }}
                    aria-label={`Delete ${t.displayName}`}
                    title="Delete"
                  >
                    <Icon name="trash" />
                  </button>
                </span>
              </div>
            </div>
          </li>
        ))}
        <li>
          <Link href="/admin/teachers/new" className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line text-brand-600 transition hover:border-brand-200 hover:bg-brand-50">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
              <Icon name="plus" className="size-6" />
            </span>
            <span className="font-semibold">Add teacher</span>
          </Link>
        </li>
      </ul>
      <ConfirmDialog open={Boolean(deleting)} title="Delete this teacher?" confirmLabel="Delete teacher" busy={busy} error={error} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        <p>
          <strong>{deleting?.displayName}</strong>&apos;s profile and photo will be removed from the website. Courses and student data are not affected.
        </p>
      </ConfirmDialog>
    </>
  );
}
