import type { Metadata } from "next";
import { TeamListPage } from "@/app/admin/teachers/team-pages";

export const metadata: Metadata = { title: "Developers" };

export default function Page() {
  return <TeamListPage team="developer" />;
}
