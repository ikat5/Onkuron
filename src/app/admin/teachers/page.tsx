import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { listTeacherProfiles } from "@/services/teacher-profile";
import { TeacherList } from "./teacher-list";

export const metadata: Metadata = { title: "Teachers" };

export default async function AdminTeachersPage() {
  await requireUser("/admin/teachers", "teacher");
  await connectDB();
  const teachers = await listTeacherProfiles();
  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Profiles shown on Meet Our Teachers, the homepage and the student dashboard."
        action={
          <Link href="/admin/teachers/new" className="btn-leaf px-5 py-3">
            <Icon name="plus" className="size-5" /> Add teacher
          </Link>
        }
      />
      <TeacherList initial={teachers} />
    </>
  );
}
