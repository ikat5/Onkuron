import type { Metadata } from "next";
import { EmptyState, formatDate, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { AuditLog } from "@/models/AuditLog";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireUser("/admin/audit", "teacher");
  await connectDB();
  const entries = await AuditLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Teacher actions are recorded against the shared teacher account; they cannot identify which individual teacher acted."
      />
      {entries.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={String(e._id)}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDate(e.createdAt, true)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2.5">{e.actorRole === "teacher" ? "Shared teacher" : e.actorRole}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{e.targetType ? `${e.targetType} ${e.targetId ?? ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
