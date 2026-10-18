"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function DecisionControls({ id }: { id: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(kind: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await api(`/api/teacher/enrollments/${id}/${kind}`, { body: kind === "reject" ? { reason } : {} });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error.fields?.reason?.[0] ?? res.error.message);
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-72">
      {mode === "idle" && (
        <div className="flex gap-2 md:justify-end">
          <button type="button" className="btn-leaf px-3 py-1.5" onClick={() => setMode("approve")}>
            Approve
          </button>
          <button type="button" className="btn-danger px-3 py-1.5" onClick={() => setMode("reject")}>
            Reject
          </button>
        </div>
      )}
      {mode === "approve" && (
        <div className="rounded-lg border border-leaf-100 bg-leaf-50 p-3 text-sm">
          <p className="text-leaf-700">Confirm you have found this transaction in your account.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-leaf px-3 py-1.5" disabled={busy} onClick={() => submit("approve")}>
              {busy ? "Approving…" : "Yes, approve"}
            </button>
            <button type="button" className="btn-outline px-3 py-1.5" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "reject" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <label htmlFor={`reason-${id}`} className="label">
            Reason (sent to the student)
          </label>
          <textarea id={`reason-${id}`} className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Transaction ID not found" />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-danger px-3 py-1.5" disabled={busy} onClick={() => submit("reject")}>
              {busy ? "Rejecting…" : "Reject"}
            </button>
            <button type="button" className="btn-outline px-3 py-1.5" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
