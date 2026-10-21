import { TeamListPublicPage, teamListMetadata } from "@/components/team-pages";

export const metadata = teamListMetadata("developer");

export default function Page() {
  return <TeamListPublicPage team="developer" />;
}
