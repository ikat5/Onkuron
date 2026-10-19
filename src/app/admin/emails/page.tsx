import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/teacher/action-button";
import { Alert, EmptyState, formatDate, PageHeader, StatusBadge } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { isEmailConfigured } from "@/lib/email/service";
import { EmailOutbox } from "@/models/EmailOutbox";

export const metadata: Metadata = { title: "Email log" };

const FILTERS = { all: {}, failed: { status: { $in: ["failed", "dead"] } }, pending: { status: { $in: ["pending", "sending"] } }, sent: { status: "sent" } } as const;

const TEMPLATE_LABEL: Record<string, string> = {
  email_verified: "Email verified",
  enrollment_submitted: "Enrollment submitted",
  enrollment_approved: "Enrollment approved",
  enrollment_rejected: "Enrollment rejected",
  password_changed: "Password changed",
  registration_attempt: "Registration attempt",
};

export default async function EmailLogPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("/admin/emails", "teacher");
  const { status } = await searchParams;
  const key = (status && status in FILTERS ? status : "all") as keyof typeof FILTERS;
  await connectDB();
  const items = await EmailOutbox.find(FILTERS[key]).sort({ createdAt: -1 }).limit(100).lean();

  return (
    <>
      <PageHeader
        title="Email log"
        subtitle="Notification emails are queued and retried automatically with backoff. “Sent” means the email provider accepted the message — not that it reached the inbox."
        action={<ActionButton url="/api/teacher/emails/process" label="Process queue now" className="btn-outline" />}
      />
      {!isEmailConfigured() && (
        <div className="mb-4">
          <Alert tone="warning">Email is not configured — queued emails will wait until it is.</Alert>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(FILTERS).map((f) => (
          <Link key={f} href={`/admin/emails?status=${f}`} className={f === key ? "btn-primary px-3 py-1.5" : "btn-outline px-3 py-1.5"}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((m) => (
                <tr key={String(m._id)} className="align-top">
                  <td className="px-4 py-3 font-medium">{TEMPLATE_LABEL[m.template] ?? m.template}</td>
                  <td className="px-4 py-3">{m.to}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                    {m.lastError && m.status !== "sent" && <p className="mt-1 max-w-56 text-xs break-words text-red-700">{m.lastError}</p>}
                    {m.status === "failed" && <p className="text-xs text-muted">Next try {formatDate(m.nextAttemptAt, true)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {m.attempts}/{m.maxAttempts}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(m.createdAt, true)}</td>
                  <td className="px-4 py-3">{(m.status === "failed" || m.status === "dead") && <ActionButton url={`/api/teacher/emails/${m._id}/retry`} label="Retry now" className="btn-outline px-3 py-1.5 text-xs" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
