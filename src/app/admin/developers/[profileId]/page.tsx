import type { Metadata } from "next";
import { TeamEditPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Edit developer" };

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
  return <TeamEditPage team="developer" profileId={(await params).profileId} />;
}
