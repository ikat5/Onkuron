import { TeamListPublicPage, teamListMetadata } from "@/components/team-pages";

export const metadata = teamListMetadata("editor");

export default function Page() {
  return <TeamListPublicPage team="editor" />;
}
