"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field, formValues } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

export function EnrollForm({ courseId, methods }: { courseId: string; methods: Array<{ id: string; label: string }> }) {
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Request submitted">
          Your enrollment is <strong>pending manual verification</strong>. We&apos;ve emailed you a confirmation of your submission, and you&apos;ll hear from us once a teacher reviews it.
        </Alert>
        <a href="/dashboard" className="btn-primary w-full">
          Go to my dashboard
        </a>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        // Only identifiers and payment details are sent; the price is taken from the database.
        const res = await api("/api/enrollments", { body: { ...formValues(e.currentTarget), courseId } });
        setBusy(false);
        if (res.ok) setDone(true);
        else setError(res.error);
      }}
    >
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}
      <fieldset>
        <legend className="label">Payment method</legend>
        <div className="grid grid-cols-3 gap-2">
          {(methods.length ? methods : [{ id: "bkash", label: "bKash" }, { id: "nagad", label: "Nagad" }, { id: "rocket", label: "Rocket" }]).map((m, i) => (
            <label key={m.id} className="flex cursor-pointer items-center justify-center rounded-lg border border-line px-2 py-2.5 text-sm font-semibold has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700">
              <input type="radio" name="paymentMethod" value={m.id} defaultChecked={i === 0} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
        {error?.fields?.paymentMethod && <p className="mt-1 text-xs text-red-700">{error.fields.paymentMethod[0]}</p>}
      </fieldset>
      <Field label="Transaction ID" name="transactionId" required autoComplete="off" placeholder="e.g. 9A7B6C5D4E" className="input font-mono uppercase" error={error?.fields?.transactionId} />
      <Field label="Sender mobile number" name="senderNumber" type="tel" required placeholder="01XXXXXXXXX" hint="The number you paid from" error={error?.fields?.senderNumber} />
      <button type="submit" className="btn-sun w-full" disabled={busy}>
        {busy ? "Submitting…" : "Submit for verification"}
      </button>
    </form>
  );
}
