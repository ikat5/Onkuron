import type { Metadata } from "next";
import { TeamEditPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Edit teacher" };

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
  return <TeamEditPage team="teacher" profileId={(await params).profileId} />;
}
