import { TeacherNav } from "@/components/teacher/teacher-nav";
import { Container } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  // Every teacher page is also individually guarded; this blocks the whole subtree by default.
  await requireUser("/admin", "teacher");
  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden px-3 text-xs text-muted lg:block">Admin panel</p>
          <TeacherNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
