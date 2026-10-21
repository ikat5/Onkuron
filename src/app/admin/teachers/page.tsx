import type { Metadata } from "next";
import { TeamListPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Teachers" };

export default function Page() {
  return <TeamListPage team="teacher" />;
}
