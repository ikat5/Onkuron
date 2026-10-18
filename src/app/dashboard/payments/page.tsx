import type { Metadata } from "next";
import Link from "next/link";
import { Types } from "mongoose";
import { Icon } from "@/components/icons";
import { Container, formatDate, formatTaka, PageHeader, StatusBadge } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PAYMENT_LABELS } from "@/lib/validation";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";

export const metadata: Metadata = { title: "Payment history", robots: { index: false } };

/** The student's own enrollment receipts, kept off the main dashboard on purpose. */
export default async function PaymentHistoryPage() {
  const user = await requireUser("/dashboard/payments", "student");
  await connectDB();
  const enrollments = await Enrollment.find({ studentId: new Types.ObjectId(user.id) })
    .sort({ createdAt: -1 })
    .select("courseId amount paymentMethod transactionId status createdAt decidedAt")
    .lean();
  const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.courseId) } }).select("title").lean();
  const byId = new Map(courses.map((c) => [String(c._id), c.title]));

  return (
    <Container className="py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <Icon name="left" /> My learning
      </Link>
      <PageHeader title="Payment history" subtitle="Your enrollment requests and the payment details you submitted." />
      {enrollments.length === 0 ? (
        <p className="text-sm text-muted">You haven&apos;t submitted any enrollment requests yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {enrollments.map((e) => (
                <tr key={String(e._id)} className="hover:bg-canvas">
                  <td className="px-4 py-3 font-medium">{byId.get(String(e.courseId)) ?? "Removed course"}</td>
                  <td className="px-4 py-3">{formatTaka(e.amount)}</td>
                  <td className="px-4 py-3">
                    {PAYMENT_LABELS[e.paymentMethod]} · <span className="font-mono text-xs">{e.transactionId}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} label={e.status === "pending" ? "Being reviewed" : e.status === "approved" ? "Verified" : "Not approved"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
