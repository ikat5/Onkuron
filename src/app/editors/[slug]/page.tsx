import type { Metadata } from "next";
import { TeamProfilePublicPage, teamProfileMetadata } from "@/components/team-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return teamProfileMetadata("editor", (await params).slug);
}

export default async function Page({ params }: Props) {
  return <TeamProfilePublicPage team="editor" slug={(await params).slug} />;
}
