import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getOrCreateStudentConversation } from "@/services/chat";
import { loadLearnerCourse } from "../load";
import { LessonView } from "./lesson-view";

export const metadata: Metadata = { title: "Lesson", robots: { index: false } };

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/learn/${slug}/${lessonId}`);
  await connectDB();

  // Server-side enrollment check before any lesson metadata is loaded.
  const result = await loadLearnerCourse(user, slug);
  if (result === "forbidden") redirect(`/courses/${slug}`);
  if (result === "missing") notFound();
  const { course, lessons, progress } = result;
  if (!lessons.some((l) => l.id === lessonId)) notFound();

  const conversation = user.role === "student" ? await getOrCreateStudentConversation(user) : null;
  return (
    <LessonView
      course={{ id: course.id, title: course.title, slug: course.slug }}
      lessons={lessons}
      initialProgress={progress}
      currentId={lessonId}
      role={user.role === "teacher" ? "teacher" : "student"}
      conversationId={conversation ? String(conversation._id) : undefined}
    />
  );
}
