"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field, formValues } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

export function ChangePasswordForm() {
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError(null);
        setMessage(null);
        const res = await api<{ message: string }>("/api/auth/change-password", { body: formValues(form) });
        setBusy(false);
        if (res.ok) {
          setMessage(res.data.message);
          form.reset();
        } else setError(res.error);
      }}
    >
      {message && <Alert tone="success">{message}</Alert>}
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}
      <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required error={error?.fields?.currentPassword} />
      <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number" error={error?.fields?.newPassword} />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required error={error?.fields?.confirmPassword} />
      <button className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

export function SignOutEverywhere() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-danger"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout-all", { method: "POST", body: {} });
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out of all devices
    </button>
  );
}
