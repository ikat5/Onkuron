import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ContentList } from "@/components/teacher/content-list";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { MODULE_LABELS } from "@/lib/interactive";
import { listTopics } from "@/services/interactive";

export const metadata: Metadata = { title: "Interactive lessons" };

export default async function InteractiveTopicsPage() {
  await requireUser("/admin/interactive", "teacher");
  await connectDB();
  const topics = await listTopics();
  const rows = topics.map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.learn.join(" · ") || "No learning points yet",
    meta: [t.chapter, t.module ? MODULE_LABELS[t.module] : "No simulation yet"].filter(Boolean).join(" · "),
    glyph: t.glyph || t.title.slice(0, 1),
    published: t.published,
    body: { title: t.title, chapter: t.chapter, chapterBn: t.chapterBn, glyph: t.glyph, learn: t.learn, module: t.module ?? "", courseId: t.courseId ?? "", published: t.published },
  }));
  return (
    <>
      <PageHeader
        title="Interactive lessons"
        subtitle={
          <>
            Topics of the homepage HSC ICT lab (“Interactive Visual Learning”), in this order.
          </>
        }
        action={
          <Link href="/admin/interactive/new" className="btn-leaf shrink-0 px-5 py-3 whitespace-nowrap">
            <Icon name="plus" className="size-5" /> Add lesson
          </Link>
        }
      />
      <ContentList key={rows.map((r) => `${r.id}:${r.published}`).join()} kind="topics" initial={rows} />
    </>
  );
}
