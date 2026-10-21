import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { TeacherProfileView } from "@/components/teacher-profile-view";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { featureStatus } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { TEAMS, type Team } from "@/lib/team";
import { listPublishedCourses } from "@/services/courses";
import { getTeamPhotoUrl } from "@/services/settings";
import { getTeacherProfile, listTeacherProfiles, toPublicProfile } from "@/services/teacher-profile";
import { courseOptions } from "./load";
import { TeacherEditor } from "./teacher-editor";
import { TeacherList } from "./teacher-list";
import { TeamPhoto } from "./team-photo";

/**
 * Admin pages shared by the teacher, developer and video editor teams.
 * Each team's route files under /admin/<team> render these.
 */

const SUBTITLES: Record<Team, string> = {
  teacher: "Profiles shown on Meet Our Teachers, the homepage and the student dashboard.",
  developer: "Profiles shown on Meet Our Developer Team and the homepage.",
  editor: "Profiles shown on Meet Our Video Editor Team (linked from the footer).",
};

async function loadProfile(team: Team, profileId: string) {
  return getTeacherProfile(profileId, team).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
}

function BackLink({ team }: { team: Team }) {
  const cfg = TEAMS[team];
  return (
    <Link href={cfg.adminPath} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
      <Icon name="left" /> All {cfg.plural.toLowerCase()}
    </Link>
  );
}

export async function TeamListPage({ team }: { team: Team }) {
  const cfg = TEAMS[team];
  await requireUser(cfg.adminPath, "teacher");
  await connectDB();
  const [profiles, teamPhotoUrl] = await Promise.all([listTeacherProfiles(team), team === "teacher" ? getTeamPhotoUrl() : undefined]);
  return (
    <>
      <PageHeader
        title={cfg.plural}
        subtitle={SUBTITLES[team]}
        action={
          <Link href={`${cfg.adminPath}/new`} className="btn-leaf px-5 py-3">
            <Icon name="plus" className="size-5" /> Add {cfg.singular.toLowerCase()}
          </Link>
        }
      />
      {team === "teacher" && <TeamPhoto url={teamPhotoUrl} canUpload={featureStatus().cloudinary.ok} />}
      <TeacherList team={team} initial={profiles} />
    </>
  );
}

export async function TeamNewPage({ team }: { team: Team }) {
  const cfg = TEAMS[team];
  await requireUser(`${cfg.adminPath}/new`, "teacher");
  await connectDB();
  return (
    <>
      <BackLink team={team} />
      <PageHeader title={`Add ${cfg.singular.toLowerCase()}`} subtitle="Create a public profile. You can upload a photo right after saving." />
      <TeacherEditor team={team} initial={null} courses={cfg.hasCourses ? await courseOptions() : []} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}

export async function TeamEditPage({ team, profileId }: { team: Team; profileId: string }) {
  const cfg = TEAMS[team];
  await requireUser(`${cfg.adminPath}/${profileId}`, "teacher");
  await connectDB();
  const profile = await loadProfile(team, profileId);
  return (
    <>
      <BackLink team={team} />
      <PageHeader title={profile.displayName} subtitle={profile.published ? "Published on the website" : "Draft — not visible to visitors"} />
      <TeacherEditor team={team} initial={profile} courses={cfg.hasCourses ? await courseOptions() : []} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}

/** Admin-only preview of a saved profile, published or not. */
export async function TeamPreviewPage({ team, profileId }: { team: Team; profileId: string }) {
  const cfg = TEAMS[team];
  await requireUser(`${cfg.adminPath}/${profileId}/preview`, "teacher");
  await connectDB();
  const profile = await loadProfile(team, profileId);
  const courses = cfg.hasCourses && profile.courseIds.length ? await listPublishedCourses({ onlyIds: profile.courseIds }) : [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sun-100 bg-sun-50 px-4 py-3 text-sm text-sun-700">
        <Icon name="eye" /> Preview of {profile.displayName} — {profile.published ? "public." : "not public yet."}
        <Link href={`${cfg.adminPath}/${profile.id}`} className="ml-auto font-semibold underline">
          Back to editor
        </Link>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas">
        <TeacherProfileView profile={toPublicProfile(profile)} courses={courses} />
      </div>
    </div>
  );
}
