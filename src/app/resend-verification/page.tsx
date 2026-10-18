import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { EmailRequestForm } from "@/components/email-request-form";

export const metadata: Metadata = { title: "Resend verification email" };

export default async function ResendPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Resend verification email"
      subtitle="We'll send a fresh link. Older links stop working."
      footer={
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <EmailRequestForm endpoint="/api/auth/resend-verification" submitLabel="Send new link" defaultEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthCard>
  );
}
