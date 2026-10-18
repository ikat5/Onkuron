import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password">
      {typeof token === "string" && token.length >= 20 ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error">This reset link is invalid.</Alert>
          <Link href="/forgot-password" className="btn-primary w-full">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
