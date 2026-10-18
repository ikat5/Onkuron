"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

interface Settings {
  paymentNumbers: { bkash: string; nagad: string; rocket: string };
  paymentInstructions: string;
  supportEmail: string;
  supportPhone: string;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const fieldErr = (k: string) => error?.fields?.[k];

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => String(fd.get(k) ?? "");
        setBusy(true);
        setError(null);
        setSaved(false);
        const res = await api("/api/teacher/settings", {
          method: "PUT",
          body: {
            paymentNumbers: { bkash: v("bkash"), nagad: v("nagad"), rocket: v("rocket") },
            paymentInstructions: v("paymentInstructions"),
            supportEmail: v("supportEmail"),
            supportPhone: v("supportPhone"),
          },
        });
        setBusy(false);
        if (res.ok) setSaved(true);
        else setError(res.error);
      }}
    >
      {error && <Alert tone="error">{error.message}</Alert>}
      {saved && <Alert tone="success">Settings saved.</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="bKash number" name="bkash" defaultValue={initial.paymentNumbers.bkash} placeholder="01XXXXXXXXX" error={fieldErr("paymentNumbers")} />
        <Field label="Nagad number" name="nagad" defaultValue={initial.paymentNumbers.nagad} placeholder="01XXXXXXXXX" />
        <Field label="Rocket number" name="rocket" defaultValue={initial.paymentNumbers.rocket} placeholder="01XXXXXXXXXX" />
      </div>
      <div>
        <label htmlFor="f-instr" className="label">
          Payment instructions
        </label>
        <textarea id="f-instr" name="paymentInstructions" rows={3} maxLength={2000} className="input" defaultValue={initial.paymentInstructions} placeholder="e.g. Use Send Money and write your name in the reference." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support email (shown in emails)" name="supportEmail" type="email" defaultValue={initial.supportEmail} error={fieldErr("supportEmail")} />
        <Field label="Support phone" name="supportPhone" type="tel" defaultValue={initial.supportPhone} error={fieldErr("supportPhone")} />
      </div>
      <button className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
