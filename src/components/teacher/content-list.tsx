"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { categoryIcon } from "@/lib/categories";

const KINDS = {
  categories: { api: "/api/teacher/categories", admin: "/admin/categories", singular: "category", where: "the homepage learning paths and the catalogue filters" },
  topics: { api: "/api/teacher/topics", admin: "/admin/interactive", singular: "interactive lesson", where: "the homepage interactive learning section" },
} as const;

export interface ContentRow {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  imageUrl?: string;
  icon?: string;
  glyph?: string;
  published: boolean;
  publicHref?: string;
  /** The item's full PUT body, used to flip `published` from the list. */
  body: Record<string, unknown>;
}

/**
 * Admin list of categories or interactive lessons in homepage order: move
 * up/down, publish/unpublish in place, edit and delete (with confirmation;
 * the server refuses unsafe deletes and the reason is shown in the dialog).
 */
export function ContentList({ kind, initial }: { kind: keyof typeof KINDS; initial: ContentRow[] }) {
  const cfg = KINDS[kind];
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const before = rows;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    const res = await api(`${cfg.api}/order`, { method: "PUT", body: { ids: next.map((r) => r.id) } });
    if (!res.ok) {
      setRows(before);
      toast(res.error.message, "error");
    } else router.refresh();
  }

  async function togglePublished(row: ContentRow) {
    setPending(row.id);
    const res = await api(`${cfg.api}/${row.id}`, { method: "PUT", body: { ...row.body, published: !row.published } });
    setPending(null);
    if (!res.ok) return toast(res.error.message, "error");
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, published: !row.published, body: { ...r.body, published: !row.published } } : r)));
    toast(row.published ? `“${row.title}” is now hidden from the website.` : `“${row.title}” is now live on the website.`);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const res = await api<{ uncategorized?: number }>(`${cfg.api}/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setRows((rs) => rs.filter((r) => r.id !== deleting.id));
    const moved = res.data.uncategorized ?? 0;
    toast(moved ? `“${deleting.title}” deleted. ${moved} course${moved === 1 ? " is" : "s are"} now without a category.` : `“${deleting.title}” deleted.`);
    setDeleting(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
          <Icon name={kind === "categories" ? "grid" : "layers"} className="size-8" />
        </span>
        <p className="mt-4 text-lg font-bold text-ink">No {cfg.singular === "category" ? "categories" : "interactive lessons"} yet</p>
        <p className="mt-1 max-w-md text-sm text-muted">Published ones appear on {cfg.where}.</p>
        <Link href={`${cfg.admin}/new`} className="btn-leaf mt-5">
          <Icon name="plus" /> Add your first {cfg.singular}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className="card flex flex-col gap-4 p-3 transition hover:border-brand-200 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-muted">{i + 1}</span>
              <Link href={`${cfg.admin}/${r.id}`} className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-night-800 text-white" aria-label={`Edit ${r.title}`}>
                {r.imageUrl ? (
                  <Image src={r.imageUrl} alt="" fill sizes="112px" className="object-cover" />
                ) : r.glyph ? (
                  <span className="font-mono text-lg font-bold">{r.glyph}</span>
                ) : (
                  <Icon name={categoryIcon(r.icon)} className="size-7 text-white/85" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`${cfg.admin}/${r.id}`} className="font-bold text-ink hover:text-brand-700">
                    {r.title}
                  </Link>
                  <span className={`badge ${r.published ? "bg-leaf-100 text-leaf-700" : "bg-slate-100 text-slate-700"}`}>{r.published ? "Published" : "Hidden"}</span>
                </p>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">{r.subtitle}</p>
                {r.meta && <p className="mt-1 text-xs font-semibold text-brand-600">{r.meta}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-line pt-3 sm:border-0 sm:pt-0">
              <button type="button" onClick={() => togglePublished(r)} disabled={pending === r.id} className={`btn px-3 py-1.5 text-xs ${r.published ? "border border-line bg-white text-ink hover:border-brand-200" : "bg-leaf-600 text-white hover:bg-leaf-700"}`}>
                {pending === r.id ? "Saving…" : r.published ? "Unpublish" : "Publish"}
              </button>
              <Link href={`${cfg.admin}/${r.id}`} className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label={`Edit ${r.title}`} title="Edit">
                <Icon name="pencil" />
              </Link>
              {r.publicHref && (
                <Link href={r.publicHref} className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label={`View ${r.title} on the website`} title={r.published ? "View on the website" : "Preview"}>
                  <Icon name="eye" />
                </Link>
              )}
              <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.title} up`} title="Move up">
                <Icon name="up" />
              </button>
              <button type="button" className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.title} down`} title="Move down">
                <Icon name="down" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  setError(null);
                  setDeleting(r);
                }}
                aria-label={`Delete ${r.title}`}
                title="Delete"
              >
                <Icon name="trash" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <ConfirmDialog open={Boolean(deleting)} title={`Delete this ${cfg.singular}?`} confirmLabel={`Delete ${cfg.singular}`} busy={busy} error={error} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        <p>
          <strong>{deleting?.title}</strong> will be removed from {cfg.where}.{kind === "categories" ? " Its courses are not deleted: they stay published, just without a category. To hide it temporarily, unpublish it instead." : " To hide it temporarily, unpublish it instead."}
        </p>
      </ConfirmDialog>
    </>
  );
}
