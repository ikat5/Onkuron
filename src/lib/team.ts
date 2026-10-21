import type { IconName } from "@/components/icons";

/**
 * Public profiles are grouped into teams. Teachers, developers and video
 * editors share one model and one admin editor; this holds what differs.
 */
export const TEAM_IDS = ["teacher", "developer", "editor"] as const;
export type Team = (typeof TEAM_IDS)[number];

export interface TeamConfig {
  singular: string;
  plural: string;
  /** Public list page; profiles live at `${publicPath}/${slug}`. */
  publicPath: string;
  adminPath: string;
  pageTitle: string;
  icon: IconName;
  subjectsLabel: string;
  subjectsPlaceholder: string;
  headlinePlaceholder: string;
  philosophyLabel: string;
  /** Only teachers are linked to courses. */
  hasCourses: boolean;
}

export const TEAMS: Record<Team, TeamConfig> = {
  teacher: {
    singular: "Teacher",
    plural: "Teachers",
    publicPath: "/teachers",
    adminPath: "/admin/teachers",
    pageTitle: "Meet Our Teachers",
    icon: "user",
    subjectsLabel: "Subjects taught",
    subjectsPlaceholder: "e.g. HSC ICT",
    headlinePlaceholder: "e.g. HSC ICT & web development teacher",
    philosophyLabel: "Teaching philosophy",
    hasCourses: true,
  },
  developer: {
    singular: "Developer",
    plural: "Developers",
    publicPath: "/developers",
    adminPath: "/admin/developers",
    pageTitle: "Meet Our Developer Team",
    icon: "code",
    subjectsLabel: "Skills",
    subjectsPlaceholder: "e.g. Next.js",
    headlinePlaceholder: "e.g. Full-stack developer",
    philosophyLabel: "How I work",
    hasCourses: false,
  },
  editor: {
    singular: "Video editor",
    plural: "Video editors",
    publicPath: "/editors",
    adminPath: "/admin/editors",
    pageTitle: "Meet Our Video Editor Team",
    icon: "video",
    subjectsLabel: "Skills",
    subjectsPlaceholder: "e.g. Premiere Pro",
    headlinePlaceholder: "e.g. Lesson video editor",
    philosophyLabel: "How I work",
    hasCourses: false,
  },
};

/** Profiles saved before teams existed have no `team` and are teachers. */
export function teamFilter(team: Team): { team: Team | { $nin: Team[] } } {
  return team === "teacher" ? { team: { $nin: ["developer", "editor"] } } : { team };
}
