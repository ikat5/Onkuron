"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { Uploader } from "@/components/teacher/uploader";
import { useToast } from "@/components/toast";
import { YouTubePreview } from "@/components/youtube-preview";
import { api } from "@/lib/api-client";
import { TEAMS, type Team } from "@/lib/team";
import { parseYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube";
import type { TeacherProfileDTO } from "@/services/teacher-profile";

interface Achievement {
  key: string;
  title: string;
  description: string;
  year: string;
}

interface Draft {
  published: boolean;
  displayName: string;
  slug: string;
  headline: string;
  shortBio: string;
  bio: string;
  philosophy: string;
  subjects: string[];
  expertise: string[];
  achievements: Achievement[];
  courseIds: string[];
  youtubeUrl: string;
}

export interface CourseOption {
  id: string;
  title: string;
  published: boolean;
}

/** Draft without the client-only row keys, for change detection. */
const comparable = (x: Draft) => JSON.stringify({ ...x, courseIds: [...x.courseIds].sort(), achievements: x.achievements.map((a) => [a.title, a.description, a.year]) });

let keySeq = 0;
const newKey = () => `a${++keySeq}`;

function draftOf(p: TeacherProfileDTO | null): Draft {
  return {
    published: p?.published ?? false,
    displayName: p?.displayName ?? "",
    slug: p?.slug ?? "",
    headline: p?.headline ?? "",
    shortBio: p?.shortBio ?? "",
    bio: p?.bio ?? "",
    philosophy: p?.philosophy ?? "",
    subjects: p?.subjects ?? [],
    expertise: p?.expertise ?? [],
    achievements: (p?.achievements ?? []).map((a) => ({ key: a.id, title: a.title, description: a.description, year: a.year ? String(a.year) : "" })),
    courseIds: p?.courseIds ?? [],
    youtubeUrl: p?.youtubeVideoId ? youtubeWatchUrl(p.youtubeVideoId) : "",
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-bold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TagInput({ id, label, values, onChange, placeholder }: { id: string; label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim().replace(/,$/, "");
    if (v && !values.includes(v) && values.length < 20) onChange([...values, v.slice(0, 60)]);
    setText("");
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        {values.map((v) => (
          <span key={v} className="badge gap-1 bg-brand-50 py-1 text-brand-700">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full hover:text-red-700">
              <Icon name="x" className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={add}
          placeholder={values.length ? "Add another…" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-muted">Press Enter or comma to add. Up to 20.</p>
    </div>
  );
}

/** Creates (initial = null) or edits one teacher, developer or video editor profile. */
export function TeacherEditor({ team, initial, courses, canUpload }: { team: Team; initial: TeacherProfileDTO | null; courses: CourseOption[]; canUpload: boolean }) {
  const cfg = TEAMS[team];
  const who = cfg.singular.toLowerCase();
  const router = useRouter();
  const toast = useToast();
  const isNew = !initial;
  const [saved, setSaved] = useState(() => draftOf(initial));
  const [d, setD] = useState(() => draftOf(initial));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"photo" | "teacher" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // The photo comes from fresh server data (router.refresh after upload), so unsaved edits survive an upload.
  const [removedPhoto, setRemovedPhoto] = useState<string | undefined>();
  const photoUrl = initial?.photoUrl && initial.photoUrl !== removedPhoto ? initial.photoUrl : undefined;

  const dirty = useMemo(() => comparable(d) !== comparable(saved), [d, saved]);
  const videoId = parseYouTubeUrl(d.youtubeUrl);
  const videoInvalid = d.youtubeUrl.trim() !== "" && !videoId;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setD((x) => {
      const next = { ...x, [key]: value };
      if (key === "displayName" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }
  function setAch(i: number, patch: Partial<Achievement>) {
    set(
      "achievements",
      d.achievements.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    );
  }
  function moveAch(i: number, dir: -1 | 1) {
    const list = [...d.achievements];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set("achievements", list);
  }

  async function save() {
    const found: Record<string, string> = {};
    if (d.displayName.trim().length < 2) found.displayName = `Enter the ${who}'s public name`;
    if (d.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) found.slug = "Use lowercase letters, numbers and hyphens";
    if (videoInvalid) found.youtubeUrl = "Not a valid YouTube video link";
    d.achievements.forEach((a, i) => {
      if (a.title.trim().length < 2) found[`achievements.${i}`] = "Give this achievement a title";
      if (a.year && !/^\d{4}$/.test(a.year)) found[`achievements.${i}`] = "Year must be four digits";
    });
    setErrors(found);
    if (Object.keys(found).length) return toast("Please fix the highlighted fields.", "error");

    setBusy(true);
    const body = {
      ...d,
      team,
      slug: d.slug || undefined,
      achievements: d.achievements.map((a) => ({ title: a.title, description: a.description, year: a.year ? Number(a.year) : null })),
      youtubeUrl: d.youtubeUrl.trim(),
    };
    const res = isNew
      ? await api<{ teacher: TeacherProfileDTO }>("/api/teacher/teachers", { body })
      : await api<{ teacher: TeacherProfileDTO }>(`/api/teacher/teachers/${initial!.id}`, { method: "PUT", body });
    setBusy(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(Object.fromEntries(Object.entries(res.error.fields).map(([k, v]) => [k, v?.[0]])));
      if (res.error.code === "conflict") setErrors((e) => ({ ...e, slug: res.error.message }));
      return toast(res.error.message, "error");
    }
    const next = draftOf(res.data.teacher);
    setSaved(next);
    setD(next);
    setSlugTouched(true);
    if (isNew) {
      toast(`${res.data.teacher.displayName} added. You can now upload a photo.`);
      router.replace(`${cfg.adminPath}/${res.data.teacher.id}`);
    } else {
      toast(res.data.teacher.published ? `${cfg.singular} saved and published.` : `${cfg.singular} saved (not public yet).`);
      router.refresh();
    }
  }

  async function runConfirm() {
    if (!initial) return;
    setConfirmBusy(true);
    const res = await api(confirm === "photo" ? `/api/teacher/teachers/${initial.id}/photo` : `/api/teacher/teachers/${initial.id}`, { method: "DELETE" });
    setConfirmBusy(false);
    if (!res.ok) return toast(res.error.message, "error");
    if (confirm === "photo") {
      setRemovedPhoto(photoUrl);
      setConfirm(null);
      toast("Photo removed.");
      router.refresh();
    } else {
      toast(`${initial.displayName} deleted.`);
      router.push(cfg.adminPath);
      router.refresh();
    }
  }

  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-red-700">{errors[k]}</p> : null);
  const toggleCourse = (id: string) => set("courseIds", d.courseIds.includes(id) ? d.courseIds.filter((c) => c !== id) : [...d.courseIds, id]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Section title="Basics" hint={`Only what you enter here is shown publicly. Don't add qualifications the ${who} can't support.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-name" className="label">
                  Name <span className="text-red-600">*</span>
                </label>
                <input id="p-name" className="input" value={d.displayName} maxLength={80} onChange={(e) => set("displayName", e.target.value)} aria-invalid={errors.displayName ? true : undefined} autoFocus={isNew} />
                {err("displayName")}
              </div>
              <div>
                <label htmlFor="p-slug" className="label">
                  Profile URL
                </label>
                <div className="flex items-center rounded-lg border border-line bg-canvas focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                  <span className="pl-3 text-sm text-muted">{cfg.publicPath}/</span>
                  <input
                    id="p-slug"
                    className="w-full bg-transparent px-1 py-2.5 text-sm focus:outline-none"
                    value={d.slug}
                    maxLength={80}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }}
                    aria-invalid={errors.slug ? true : undefined}
                  />
                </div>
                {err("slug")}
              </div>
            </div>
            <div>
              <label htmlFor="p-headline" className="label">
                Headline
              </label>
              <input id="p-headline" className="input" value={d.headline} maxLength={120} onChange={(e) => set("headline", e.target.value)} placeholder={cfg.headlinePlaceholder} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-short" className="label">
                  Short biography
                </label>
                <span className="text-xs text-muted">{d.shortBio.length}/300</span>
              </div>
              <textarea id="p-short" rows={2} className="input" value={d.shortBio} maxLength={300} onChange={(e) => set("shortBio", e.target.value)} placeholder="One or two sentences shown on teacher cards." />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-bio" className="label">
                  Full biography
                </label>
                <span className="text-xs text-muted">{d.bio.length}/5000</span>
              </div>
              <textarea id="p-bio" rows={7} className="input leading-relaxed" value={d.bio} maxLength={5000} onChange={(e) => set("bio", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-phil" className="label">
                {cfg.philosophyLabel}
              </label>
              <textarea id="p-phil" rows={3} className="input leading-relaxed" value={d.philosophy} maxLength={1500} onChange={(e) => set("philosophy", e.target.value)} />
            </div>
          </Section>

          <Section title={cfg.hasCourses ? "Subjects & expertise" : "Skills & expertise"}>
            <TagInput id="p-subjects" label={cfg.subjectsLabel} values={d.subjects} onChange={(v) => set("subjects", v)} placeholder={cfg.subjectsPlaceholder} />
            <TagInput id="p-expertise" label="Expertise" values={d.expertise} onChange={(v) => set("expertise", v)} placeholder="e.g. React" />
          </Section>

          {cfg.hasCourses && (
          <Section title="Courses taught" hint="Shown on this teacher's public profile and on each course page.">
            {courses.length === 0 ? (
              <p className="text-sm text-muted">No courses yet.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {courses.map((c) => (
                  <li key={c.id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${d.courseIds.includes(c.id) ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200"}`}>
                      <input type="checkbox" className="size-4 accent-brand-600" checked={d.courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.title}</span>
                      {!c.published && <span className="badge bg-slate-100 text-slate-700">Draft</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          )}

          <Section title="Achievements" hint="Add, edit, reorder or remove. Shown in this order.">
            {d.achievements.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No achievements yet.</p>}
            <ol className="space-y-3">
              {d.achievements.map((a, i) => (
                <li key={a.key} className="rounded-xl border border-line bg-canvas p-4 transition hover:border-brand-200">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-sun-100 text-xs font-bold text-sun-700">{i + 1}</span>
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_100px]">
                      <input className="input" value={a.title} maxLength={120} onChange={(e) => setAch(i, { title: e.target.value })} placeholder="Title" aria-label={`Achievement ${i + 1} title`} />
                      <input className="input" value={a.year} inputMode="numeric" maxLength={4} onChange={(e) => setAch(i, { year: e.target.value.replace(/\D/g, "") })} placeholder="Year" aria-label={`Achievement ${i + 1} year`} />
                      <textarea className="input sm:col-span-2" rows={2} value={a.description} maxLength={400} onChange={(e) => setAch(i, { description: e.target.value })} placeholder="Short description (optional)" aria-label={`Achievement ${i + 1} description`} />
                      {errors[`achievements.${i}`] && <p className="text-xs text-red-700 sm:col-span-2">{errors[`achievements.${i}`]}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-brand-700 disabled:opacity-30" onClick={() => moveAch(i, -1)} disabled={i === 0} aria-label="Move up">
                        <Icon name="up" />
                      </button>
                      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-brand-700 disabled:opacity-30" onClick={() => moveAch(i, 1)} disabled={i === d.achievements.length - 1} aria-label="Move down">
                        <Icon name="down" />
                      </button>
                      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-700" onClick={() => set("achievements", d.achievements.filter((_, j) => j !== i))} aria-label={`Remove achievement ${i + 1}`}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="btn-outline" onClick={() => set("achievements", [...d.achievements, { key: newKey(), title: "", description: "", year: "" }])} disabled={d.achievements.length >= 30}>
              <Icon name="plus" /> Add achievement
            </button>
          </Section>

          <Section title="Introduction video (optional)" hint={`A YouTube link shown on the ${who}'s public profile.`}>
            <div>
              <label htmlFor="p-video" className="label">
                YouTube video URL
              </label>
              <input id="p-video" type="url" inputMode="url" className="input" value={d.youtubeUrl} maxLength={500} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://youtu.be/…" aria-invalid={videoInvalid ? true : undefined} />
              <p className={`mt-1 text-xs ${videoInvalid ? "text-red-700" : "text-muted"}`}>{videoInvalid ? "Not a valid YouTube video link." : videoId ? `Video ID ${videoId} detected.` : "Leave empty for no video."}</p>
            </div>
            {videoId && (
              <div className="max-w-lg overflow-hidden rounded-xl">
                <YouTubePreview key={videoId} videoId={videoId} title="Teacher introduction" />
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="card overflow-hidden">
            <div className="relative aspect-square bg-gradient-to-br from-brand-600 to-night-800">
              {photoUrl ? (
                <Image src={photoUrl} alt="Profile photo" fill sizes="300px" className="object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-white/80">
                  <Icon name="user" className="size-12" />
                  <span className="text-sm">No photo yet</span>
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-ink">Profile photograph</p>
              {isNew ? (
                <p className="text-xs text-muted">Save the {who} first, then upload a photo.</p>
              ) : !canUpload ? (
                <p className="text-xs text-sun-700">Uploads are unavailable until Cloudinary is configured.</p>
              ) : (
                <>
                  <Uploader kind="teacher_photo" profileId={initial!.id} label={photoUrl ? "Replace photo" : "Upload photo"} onDone={() => router.refresh()} />
                  <p className="text-xs text-muted">Square JPG, PNG or WebP works best.</p>
                  {photoUrl && (
                    <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => setConfirm("photo")}>
                      Remove photo
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="card space-y-4 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-leaf-600" checked={d.published} onChange={(e) => set("published", e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-ink">Show on the website</span>
                <span className="text-xs text-muted">{team === "teacher" ? "Meet Our Teachers, the homepage and the student dashboard." : team === "developer" ? "Meet Our Developer Team and the homepage." : "Meet Our Video Editor Team."}</span>
              </span>
            </label>
            <button className="btn-primary w-full" disabled={busy || (!dirty && !isNew)}>
              {busy ? "Saving…" : isNew ? `Add ${who}` : "Save changes"}
            </button>
            <p className="text-center text-xs" aria-live="polite">
              {dirty ? <span className="font-semibold text-sun-700">● Unsaved changes</span> : <span className="text-muted">{isNew ? "Not saved yet" : "All changes saved"}</span>}
            </p>
            {!isNew && (
              <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
                <Link href={`${cfg.adminPath}/${initial!.id}/preview`} className="btn-outline">
                  <Icon name="eye" /> Preview profile
                </Link>
                {initial!.published && (
                  <Link href={`${cfg.publicPath}/${initial!.slug}`} className="text-center text-xs font-semibold text-brand-600 hover:underline">
                    Open public page
                  </Link>
                )}
                <button type="button" className="mt-1 text-xs font-semibold text-red-700 hover:underline" onClick={() => setConfirm("teacher")}>
                  Delete this {who}
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "photo" ? "Remove profile photo?" : `Delete this ${who}?`}
        confirmLabel={confirm === "photo" ? "Remove photo" : `Delete ${who}`}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      >
        <p>{confirm === "photo" ? "The photo will be deleted from storage." : `${initial?.displayName}'s profile and photo will be removed from the website.${cfg.hasCourses ? " Courses and students are not affected." : ""}`}</p>
      </ConfirmDialog>
    </form>
  );
}
