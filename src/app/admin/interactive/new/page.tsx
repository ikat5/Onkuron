import type { Metadata } from "next";
import Link from "next/link";
import { courseOptions } from "@/app/admin/teachers/load";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { TopicEditor } from "../topic-editor";

export const metadata: Metadata = { title: "New interactive lesson" };

export default async function NewTopicPage() {
  await requireUser("/admin/interactive/new", "teacher");
  await connectDB();
  return (
    <>
      <Link href="/admin/interactive" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> All interactive lessons
      </Link>
      <PageHeader title="New interactive lesson" subtitle="Name the topic and choose the simulation it runs in the homepage HSC ICT lab." />
      <TopicEditor initial={null} courses={await courseOptions()} />
    </>
  );
}
