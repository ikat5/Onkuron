import type { Metadata } from "next";
import { ChangePasswordForm, SignOutEverywhere } from "@/components/account-security";
import { Container, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <Container className="max-w-2xl py-10">
      <PageHeader title="Account" subtitle={`${user.name} · ${user.email}`} />
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-ink">Change password</h2>
        <ChangePasswordForm />
      </section>
      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-ink">Sessions</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Signs you out everywhere, including this device.</p>
        <SignOutEverywhere />
      </section>
    </Container>
  );
}
