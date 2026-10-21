import type { Metadata } from "next";
import { ChangePasswordForm, SignOutEverywhere } from "@/components/account-security";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import Link from "next/link";
import { getSettings } from "@/services/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function TeacherSettingsPage() {
  await requireUser("/admin/settings", "teacher");
  await connectDB();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <p className="mb-6 max-w-3xl rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        The homepage promotional video is managed on the{" "}
        <Link href="/admin/promo-video" className="font-semibold underline">
          Promo video
        </Link>{" "}
        page.
      </p>
      <section className="card max-w-3xl p-6">
        <h2 className="mb-1 font-semibold text-ink">Payments &amp; support</h2>
        <p className="mb-4 text-sm text-muted">Receiving numbers shown to students on the enrollment page. Never enter PINs or account passwords here.</p>
        <SettingsForm initial={settings} />
      </section>
      <section className="card mt-6 max-w-3xl p-6">
        <h2 className="mb-1 font-semibold text-ink">Shared teacher password</h2>
        <p className="mb-4 text-sm text-muted">Changing it signs every teacher out. Share the new password with your team through a secure channel.</p>
        <ChangePasswordForm />
      </section>
      <section className="card mt-6 max-w-3xl p-6">
        <h2 className="mb-1 font-semibold text-ink">Sessions</h2>
        <p className="mb-4 text-sm text-muted">Signs out every device that uses the teacher account.</p>
        <SignOutEverywhere />
      </section>
    </>
  );
}
