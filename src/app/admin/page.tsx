import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { IntroVideo } from "@/components/intro-video";
import { Alert } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { featureStatus } from "@/lib/env";
import { Conversation } from "@/models/Chat";
import { Course } from "@/models/Course";
import { EmailOutbox } from "@/models/EmailOutbox";
import { Enrollment } from "@/models/Enrollment";
import { TeacherProfile } from "@/models/TeacherProfile";
import { teamFilter } from "@/lib/team";
import { User } from "@/models/User";
import { getIntro } from "@/services/settings";

export const metadata: Metadata = { title: "Admin panel" };

export default async function TeacherHome() {
  const user = await requireUser("/admin", "teacher");
  await connectDB();
  const [pending, approved, students, courses, published, unread, failedEmails, intro, teacherCount] = await Promise.all([
    Enrollment.countDocuments({ status: "pending" }),
    Enrollment.countDocuments({ status: "approved" }),
    User.countDocuments({ role: "student", emailVerified: true }),
    Course.countDocuments({}),
    Course.countDocuments({ published: true }),
    Conversation.countDocuments({ unreadForTeacher: { $gt: 0 } }),
    EmailOutbox.countDocuments({ status: { $in: ["failed", "dead"] } }),
    getIntro(),
    TeacherProfile.countDocuments(teamFilter("teacher")),
  ]);
  const features = featureStatus();

  const stats: Array<{ label: string; value: number; href?: string; icon: IconName; tone: string; hint?: string }> = [
    { label: "Pending enrollments", value: pending, href: "/admin/enrollments", icon: "receipt", tone: pending ? "bg-sun-50 text-sun-700" : "bg-leaf-50 text-leaf-700", hint: pending ? "Waiting for verification" : "All caught up" },
    { label: "Unread conversations", value: unread, href: "/admin/messages", icon: "chat", tone: unread ? "bg-sun-50 text-sun-700" : "bg-leaf-50 text-leaf-700" },
    { label: "Approved enrollments", value: approved, href: "/admin/enrollments?status=approved", icon: "check", tone: "bg-leaf-50 text-leaf-700" },
    { label: "Verified students", value: students, icon: "user", tone: "bg-brand-50 text-brand-700" },
    { label: "Courses", value: courses, href: "/admin/courses", icon: "book", tone: "bg-brand-50 text-brand-700", hint: `${published} published` },
    { label: "Undelivered emails", value: failedEmails, href: "/admin/emails?status=failed", icon: "mail", tone: failedEmails ? "bg-red-50 text-red-700" : "bg-leaf-50 text-leaf-700" },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[1.25rem] bg-night-900 p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,107,192,0.5),transparent_60%)]" />
        <div className="relative">
          <p className="text-sm text-brand-100/80">Welcome back, {user.name.split(" ")[0]} 👋</p>
          <IntroVideo
            intro={intro}
            tone="dark"
            compact
            eyebrow="Platform introduction"
            cta={
              <Link href="/admin/settings#intro" className="btn-ghost-dark px-4 py-2">
                <Icon name="pencil" /> {intro.youtubeVideoId ? "Change intro video" : "Add intro video"}
              </Link>
            }
          >
            <p className="mt-3 text-xs text-brand-100/60">Shown on the homepage “Discover Onkur” section.</p>
          </IntroVideo>
        </div>
      </section>

      {(!features.email.ok || !features.cloudinary.ok) && (
        <div className="space-y-2">
          {!features.email.ok && <Alert tone="warning" title="Email is not configured">Missing: {features.email.missing.join(", ")}. Verification and notification emails cannot be sent.</Alert>}
          {!features.cloudinary.ok && <Alert tone="warning" title="Cloudinary is not configured">Missing: {features.cloudinary.missing.join(", ")}. Uploads and protected media are unavailable.</Alert>}
        </div>
      )}

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="mb-4 text-lg font-extrabold text-ink">
          At a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => {
            const inner = (
              <>
                <span className={`flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${s.tone}`}>
                  <Icon name={s.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted">{s.label}</span>
                  <span className="block text-3xl font-extrabold text-ink">{s.value}</span>
                  {s.hint && <span className="block text-xs text-muted">{s.hint}</span>}
                </span>
                {s.href && <Icon name="right" className="size-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />}
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="card lift group flex items-center gap-4 p-5 hover:border-brand-200">
                {inner}
              </Link>
            ) : (
              <div key={s.label} className="card group flex items-center gap-4 p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="mb-4 text-lg font-extrabold text-ink">
          Quick actions
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: "/admin/courses/new", title: "Create a course", text: "Add details, then build the curriculum.", icon: "plus" as const },
            { href: "/admin/teachers/new", title: "Add a teacher", text: `${teacherCount} teacher${teacherCount === 1 ? "" : "s"} on Meet Our Teachers.`, icon: "user" as const },
            { href: "/", title: "View the public site", text: "See what students see first.", icon: "eye" as const },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="card lift group flex items-start gap-3 p-5 hover:border-brand-200">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-600 text-white transition group-hover:bg-sun-500 group-hover:text-ink">
                <Icon name={a.icon} className="size-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">{a.title}</span>
                <span className="text-sm text-muted">{a.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
