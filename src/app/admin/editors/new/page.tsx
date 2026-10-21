import type { Metadata } from "next";
import { TeamNewPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Add video editor" };

export default function Page() {
  return <TeamNewPage team="editor" />;
}
