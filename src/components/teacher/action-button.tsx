"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

/** POST/DELETE button that refreshes server data on success. Confirmation is inline (no browser dialogs). */
export function ActionButton({
  url,
  method = "POST",
  body,
  label,
  confirmLabel,
  className = "btn-outline",
  onSuccess,
  redirectTo,
}: {
  url: string;
  method?: "POST" | "DELETE" | "PATCH";
  body?: unknown;
  label: string;
  confirmLabel?: string;
  className?: string;
  onSuccess?: (data: unknown) => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await api(url, { method, body: body ?? {} });
    setBusy(false);
    setArmed(false);
    if (res.ok) {
      onSuccess?.(res.data);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else setError(res.error.message);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {confirmLabel && armed ? (
        <span className="inline-flex gap-1">
          <button type="button" className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={run}>
            {busy ? "Working…" : confirmLabel}
          </button>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setArmed(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className={className} disabled={busy} onClick={() => (confirmLabel ? setArmed(true) : run())}>
          {busy ? "Working…" : label}
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
