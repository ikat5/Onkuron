import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDate, formatTaka, PageHeader, StatusBadge } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PAYMENT_LABELS } from "@/lib/validation";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { DecisionControls } from "./decision-controls";

export const metadata: Metadata = { title: "Enrollments" };

const TABS = ["pending", "approved", "rejected"] as const;

export default async function TeacherEnrollmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("/admin/enrollments", "teacher");
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t === raw) ?? "pending";
  await connectDB();
  const enrollments = await Enrollment.find({ status }).sort({ createdAt: status === "pending" ? 1 : -1 }).limit(200).lean();
  const [students, courses] = await Promise.all([
    User.find({ _id: { $in: enrollments.map((e) => e.studentId) } }).select("name email phone").lean(),
    Course.find({ _id: { $in: enrollments.map((e) => e.courseId) } }).select("title price").lean(),
  ]);
  const s = new Map(students.map((x) => [String(x._id), x]));
  const c = new Map(courses.map((x) => [String(x._id), x]));

  return (
    <>
      <PageHeader title="Enrollments" subtitle="Check each transaction in your bKash / Nagad / Rocket account before approving." />
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/enrollments?status=${t}`} className={t === status ? "btn-primary px-3 py-1.5" : "btn-outline px-3 py-1.5"}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>
      {enrollments.length === 0 ? (
        <EmptyState title={`No ${status} enrollments`} />
      ) : (
        <ul className="space-y-3">
          {enrollments.map((e) => {
            const student = s.get(String(e.studentId));
            const course = c.get(String(e.courseId));
            return (
              <li key={String(e._id)} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1 text-sm">
                    <p className="text-base font-semibold text-ink">{course?.title ?? "Removed course"}</p>
                    <p>
                      {student?.name} · <span className="text-muted">{student?.email}</span> {student?.phone && <span className="text-muted">· {student.phone}</span>}
                    </p>
                    <p>
                      <span className="font-semibold text-sun-600">{formatTaka(e.amount)}</span> via {PAYMENT_LABELS[e.paymentMethod]} from <span className="font-mono">{e.senderNumber}</span>
                    </p>
                    <p>
                      Transaction ID: <span className="rounded bg-canvas px-1.5 py-0.5 font-mono font-semibold">{e.transactionId}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Submitted {formatDate(e.createdAt, true)}
                      {e.decidedAt && ` · Decided ${formatDate(e.decidedAt, true)}`}
                    </p>
                    {e.decisionReason && <p className="text-xs text-red-700">Reason: {e.decisionReason}</p>}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <StatusBadge status={e.status} />
                    {e.status === "pending" && <DecisionControls id={String(e._id)} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
