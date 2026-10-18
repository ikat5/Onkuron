"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field, formValues } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

export function RegisterForm() {
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<{ message: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email">
          {done.message}
        </Alert>
        <p className="text-sm text-muted">
          The link expires after a while and works once. Didn&apos;t get it? Check your spam folder or{" "}
          <Link href={`/resend-verification?email=${encodeURIComponent(done.email)}`} className="font-semibold text-brand-600 hover:underline">
            resend the verification email
          </Link>
          .
        </p>
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
        const values = formValues(e.currentTarget);
        const res = await api<{ message: string }>("/api/auth/register", { body: values });
        setBusy(false);
        if (res.ok) setDone({ message: res.data.message, email: values.email });
        else setError(res.error);
      }}
    >
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}
      <Field label="Full name" name="name" autoComplete="name" required error={error?.fields?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={error?.fields?.email} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required error={error?.fields?.phone} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number" error={error?.fields?.password} />
      <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required error={error?.fields?.confirmPassword} />
      <button type="submit" className="btn-leaf w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
