"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api, type ApiError } from "@/lib/api-client";
import { COURSE_CATEGORIES } from "@/lib/categories";

interface CourseValues {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  price: number | "";
  category: string;
  published: boolean;
}

type Errors = Partial<Record<keyof CourseValues, string>>;

const EMPTY: CourseValues = { title: "", slug: "", summary: "", description: "", price: "", category: "", published: false };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mirrors the server's slugify (the server still decides and de-duplicates). */
function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function validate(v: CourseValues): Errors {
  const e: Errors = {};
  if (v.title.trim().length < 3) e.title = "Use at least 3 characters";
  if (v.slug && !SLUG_RE.test(v.slug)) e.slug = "Use lowercase letters, numbers and single hyphens";
  if (v.price === "" || !Number.isInteger(Number(v.price)) || Number(v.price) < 1) e.price = "Enter a whole amount of at least ৳1";
  else if (Number(v.price) > 1_000_000) e.price = "Maximum is ৳10,00,000";
  return e;
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={`text-xs ${value.length > max * 0.9 ? "text-sun-700" : "text-muted"}`}>
      {value.length}/{max}
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  ) : null;
}

export function CourseForm({ initial }: { initial?: CourseValues }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !initial?.id;
  const [saved, setSaved] = useState<CourseValues>(initial ?? EMPTY);
  const [values, setValues] = useState<CourseValues>(initial ?? EMPTY);
  // New courses follow the title until the teacher edits the slug by hand.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [editingSlug, setEditingSlug] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(() => (Object.keys(EMPTY) as (keyof CourseValues)[]).some((k) => String(values[k]) !== String(saved[k])), [values, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof CourseValues>(key: K, value: CourseValues[K]) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "title" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit() {
    const found = validate(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) {
      document.getElementById(`c-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    const body = {
      title: values.title.trim(),
      slug: values.slug || undefined,
      summary: values.summary.trim(),
      description: values.description.trim(),
      price: Number(values.price),
      category: values.category,
      published: values.published,
    };
    setBusy(true);
    const res = isNew
      ? await api<{ id: string; slug: string }>("/api/teacher/courses", { body })
      : await api<{ id: string; slug: string }>(`/api/teacher/courses/${initial!.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      setServerError(res.error);
      if (res.error.fields) setErrors(Object.fromEntries(Object.entries(res.error.fields).map(([k, v]) => [k, v?.[0]])) as Errors);
      return;
    }
    const next = { ...values, slug: res.data.slug };
    setSaved(next);
    setValues(next);
    setEditingSlug(false);
    if (isNew) {
      toast("Course created. Now add your lessons.");
      router.push(`/admin/courses/${res.data.id}#curriculum`);
    } else {
      toast("Course details saved.");
      router.refresh();
    }
  }

  const slugPreview = values.slug || "your-course-url";
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="card overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name="book" className="size-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-ink">Course details</h2>
          <p className="text-xs text-muted">What students see in the catalogue and on the course page.</p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {serverError && !serverError.fields && <Alert tone="error">{serverError.message}</Alert>}

        <div>
          <label htmlFor="c-title" className="label">
            Course title <span className="text-red-600">*</span>
          </label>
          <input
            id="c-title"
            className="input text-base"
            value={values.title}
            maxLength={150}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. HSC Physics — First Paper"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "c-title-err" : undefined}
          />
          <FieldError id="c-title-err" message={errors.title} />
        </div>

        <div>
          <span className="label">Course URL</span>
          {editingSlug ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center rounded-lg border border-line bg-canvas focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <span className="pl-3 text-sm text-muted">/courses/</span>
                <input
                  id="c-slug"
                  aria-label="URL slug"
                  className="w-full bg-transparent px-1 py-2.5 text-sm text-ink focus:outline-none"
                  value={values.slug}
                  maxLength={160}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  aria-invalid={errors.slug ? true : undefined}
                  aria-describedby="c-slug-help"
                />
              </div>
              <button
                type="button"
                className="btn-outline px-3 py-2"
                onClick={() => {
                  setSlugTouched(false);
                  set("slug", slugify(values.title));
                }}
              >
                Regenerate from title
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-canvas px-3 py-2.5 text-sm">
              <span className="text-muted">/courses/</span>
              <span className="font-mono text-brand-700">{slugPreview}</span>
              <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setEditingSlug(true)}>
                <Icon name="pencil" className="size-3.5" /> Edit
              </button>
            </div>
          )}
          {errors.slug ? (
            <FieldError id="c-slug-help" message={errors.slug} />
          ) : (
            <p id="c-slug-help" className="mt-1 text-xs text-muted">
              {isNew ? "Generated from the title. Edit it if you want a shorter link." : "Changing the URL of a published course breaks links you've already shared."}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div>
            <label htmlFor="c-price" className="label">
              Price <span className="text-red-600">*</span>
            </label>
            <div className="flex items-center rounded-lg border border-line bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <span className="pl-3 font-semibold text-muted">৳</span>
              <input
                id="c-price"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="w-full rounded-lg bg-transparent px-2 py-2.5 text-sm text-ink focus:outline-none"
                value={values.price}
                onChange={(e) => set("price", e.target.value === "" ? "" : Number(e.target.value))}
                aria-invalid={errors.price ? true : undefined}
                aria-describedby={errors.price ? "c-price-err" : "c-price-hint"}
              />
              <span className="pr-3 text-xs text-muted">BDT</span>
            </div>
            {errors.price ? <FieldError id="c-price-err" message={errors.price} /> : <p id="c-price-hint" className="mt-1 text-xs text-muted">Whole taka</p>}
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="c-summary" className="label">
                Short summary
              </label>
              <Counter value={values.summary} max={300} />
            </div>
            <input id="c-summary" className="input" maxLength={300} value={values.summary} onChange={(e) => set("summary", e.target.value)} placeholder="One sentence shown on course cards" />
          </div>
        </div>

        <div>
          <label htmlFor="c-category" className="label">
            Category
          </label>
          <select id="c-category" className="input" value={values.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">No category</option>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Used for the category filters in the course catalogue.</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="c-description" className="label">
              Full description
            </label>
            <Counter value={values.description} max={10000} />
          </div>
          <textarea
            id="c-description"
            rows={8}
            maxLength={10000}
            className="input leading-relaxed"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What will students learn? Who is this course for? What do they need beforehand?"
          />
        </div>

        <fieldset>
          <legend className="label">Visibility</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: false, title: "Draft", text: "Only you can see it. Students can't enroll." },
              { value: true, title: "Published", text: "Listed in the catalogue and open for enrollment." },
            ].map((o) => (
              <label
                key={o.title}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition ${values.published === o.value ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-line hover:border-brand-200"}`}
              >
                <input type="radio" name="published" className="mt-0.5 size-4 accent-brand-600" checked={values.published === o.value} onChange={() => set("published", o.value)} />
                <span>
                  <span className="block font-semibold text-ink">{o.title}</span>
                  <span className="text-xs text-muted">{o.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
        <p className="flex-1 text-xs" aria-live="polite">
          {dirty ? <span className="font-semibold text-sun-700">● Unsaved changes</span> : <span className="text-muted">{isNew ? "Fill in the details to create the course." : "All changes saved"}</span>}
        </p>
        {dirty && !isNew && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setValues(saved);
              setErrors({});
              setServerError(null);
            }}
            disabled={busy}
          >
            Discard
          </button>
        )}
        <button className="btn-primary" disabled={busy || (!dirty && !isNew)}>
          {busy ? "Saving…" : isNew ? "Create course" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
