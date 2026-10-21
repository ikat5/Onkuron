import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courseOptions } from "@/app/admin/teachers/load";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getTopic } from "@/services/interactive";
import { TopicEditor } from "../topic-editor";

export const metadata: Metadata = { title: "Edit interactive lesson" };

export default async function EditTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  await requireUser(`/admin/interactive/${topicId}`, "teacher");
  await connectDB();
  const topic = await getTopic(topicId).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  return (
    <>
      <Link href="/admin/interactive" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All interactive lessons
      </Link>
      <PageHeader title={topic.title} subtitle={topic.published ? "Published on the homepage" : "Hidden — not visible to visitors"} />
      <TopicEditor initial={topic} courses={await courseOptions()} />
    </>
  );
}
