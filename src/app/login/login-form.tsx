"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { Field, formValues } from "@/components/field";
import { api, type ApiError } from "@/lib/api-client";

export function LoginForm({ next, notice }: { next?: string; notice?: "verified" | "reset" }) {
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api<{ redirectTo: string }>("/api/auth/login", { body: { ...formValues(e.currentTarget), next } });
        if (res.ok) {
          router.replace(res.data.redirectTo);
          router.refresh();
          return;
        }
        setBusy(false);
        setError(res.error);
      }}
    >
      {notice === "verified" && <Alert tone="success">Your email is verified. Sign in to get started.</Alert>}
      {notice === "reset" && <Alert tone="success">Your password was reset. Sign in with your new password.</Alert>}
      {error && (
        <Alert tone="error">
          {error.message}
          {error.code === "email_unverified" && (
            <>
              {" "}
              <Link href={`/resend-verification?email=${encodeURIComponent(email)}`} className="font-semibold underline">
                Resend verification email
              </Link>
            </>
          )}
        </Alert>
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error?.fields?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={error?.fields?.password} />
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="text-brand-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
