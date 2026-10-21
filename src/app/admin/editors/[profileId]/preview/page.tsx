import type { Metadata } from "next";
import { TeamPreviewPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Video editor preview", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
  return <TeamPreviewPage team="editor" profileId={(await params).profileId} />;
}
