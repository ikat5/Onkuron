"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { Field, formValues } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, "", "/reset-password");
  }, []);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api("/api/auth/reset-password", { body: { ...formValues(e.currentTarget), token } });
        if (res.ok) {
          router.replace("/login?reset=1");
          return;
        }
        setBusy(false);
        setError(res.error);
      }}
    >
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}
      <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number" error={error?.fields?.password} />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required error={error?.fields?.confirmPassword} />
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
