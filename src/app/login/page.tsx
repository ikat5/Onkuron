import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth/current";
import { safeRedirectPath } from "@/lib/security/request";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; verified?: string; reset?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.role === "teacher" ? "/admin" : "/dashboard");
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue learning."
      footer={
        <>
          New to Onkuron?{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={sp.next ? safeRedirectPath(sp.next) : undefined} notice={sp.verified ? "verified" : sp.reset ? "reset" : undefined} />
    </AuthCard>
  );
}
