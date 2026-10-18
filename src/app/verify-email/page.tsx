import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { peekToken } from "@/lib/auth/tokens";
import { VerifyButton } from "./verify-button";

// The token must never leak through the Referer header (also set in next.config.ts).
export const metadata: Metadata = { title: "Verify your email", referrer: "no-referrer", robots: { index: false } };

/**
 * Opening the emailed link only *shows* a confirmation step. The token is
 * consumed by an explicit POST when the student presses the button, so email
 * security scanners and link previews that prefetch the URL cannot use it up.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let valid = false;
  if (typeof token === "string") {
    try {
      await connectDB();
      valid = Boolean(await peekToken(token, "email_verification"));
    } catch {
      valid = false;
    }
  }

  return (
    <AuthCard title="Verify your email" subtitle="One last step to activate your account.">
      {valid && token ? (
        <VerifyButton token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error" title="This link can't be used">
            The verification link is invalid, has expired, or was already used.
          </Alert>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/resend-verification" className="btn-primary flex-1">
              Send a new link
            </Link>
            <Link href="/login" className="btn-outline flex-1">
              Go to sign in
            </Link>
          </div>
        </div>
      )}
    </AuthCard>
  );
}
