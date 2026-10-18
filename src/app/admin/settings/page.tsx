import type { Metadata } from "next";
import { ChangePasswordForm, SignOutEverywhere } from "@/components/account-security";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getIntro, getSettings } from "@/services/settings";
import { IntroForm } from "./intro-form";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function TeacherSettingsPage() {
  await requireUser("/admin/settings", "teacher");
  await connectDB();
  const [settings, intro] = await Promise.all([getSettings(), getIntro()]);
  return (
    <>
      <PageHeader title="Settings" />
      <section id="intro" className="card mb-6 scroll-mt-24 p-6">
        <h2 className="mb-1 font-semibold text-ink">Platform introduction video</h2>
        <p className="mb-5 text-sm text-muted">One video and description, shown in the homepage “Discover Onkur” section.</p>
        <IntroForm initial={intro} />
      </section>
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
