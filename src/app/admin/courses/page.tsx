import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatTaka, PageHeader, StatusBadge } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";

export const metadata: Metadata = { title: "Manage courses" };

export default async function TeacherCoursesPage() {
  await requireUser("/admin/courses", "teacher");
  await connectDB();
  const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
  const counts = await Lesson.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$courseId", n: { $sum: 1 } } }]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));
  return (
    <>
      <PageHeader
        title="Courses"
        action={
          <Link href="/admin/courses/new" className="btn-leaf">
            + New course
          </Link>
        }
      />
      {courses.length === 0 ? (
        <EmptyState title="No courses yet" href="/admin/courses/new" cta="Create your first course" />
      ) : (
        <ul className="card divide-y divide-line">
          {courses.map((c) => (
            <li key={String(c._id)}>
              <Link href={`/admin/courses/${c._id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-brand-50/50">
                <span className="font-semibold text-ink">{c.title}</span>
                {c.isDemo && <span className="badge bg-sun-100 text-sun-700">Demo</span>}
                <StatusBadge status={c.published ? "published" : "draft"} />
                <span className="ml-auto text-sm text-muted">
                  {n.get(String(c._id)) ?? 0} lessons · {formatTaka(c.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
