"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

/** Shared form for "resend verification" and "forgot password". */
export function EmailRequestForm({ endpoint, submitLabel, defaultEmail = "" }: { endpoint: string; submitLabel: string; defaultEmail?: string }) {
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setMessage(null);
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        const res = await api<{ message: string }>(endpoint, { body: { email } });
        setBusy(false);
        if (res.ok) setMessage(res.data.message);
        else setError(res.error);
      }}
    >
      {message && <Alert tone="success">{message}</Alert>}
      {error && !error.fields && (
        <Alert tone="error">
          {error.message}
          {error.retryAfterSeconds ? ` (try again in ${Math.ceil(error.retryAfterSeconds / 60)} min)` : ""}
        </Alert>
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={defaultEmail} error={error?.fields?.email} />
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
