/**
 * Controlled course categories. A small fixed list (not a database model):
 * the teacher picks one per course and the catalogue filters on it.
 */
export const COURSE_CATEGORIES = [
  { id: "hsc-ict", label: "HSC ICT", blurb: "Computer fundamentals, number systems, networking, databases and the full HSC ICT syllabus." },
  { id: "programming", label: "Programming Fundamentals", blurb: "Think like a programmer: logic, C and problem solving from first principles." },
  { id: "frontend", label: "Frontend Development", blurb: "HTML, CSS, JavaScript and React — build interfaces people enjoy using." },
  { id: "backend", label: "Backend Development", blurb: "Servers, APIs, authentication and databases with Node.js." },
  { id: "fullstack", label: "Full-Stack Web Development", blurb: "Bring it together with Next.js, MongoDB and deployment." },
  { id: "projects", label: "Practical Projects", blurb: "Apply what you learn by building real, portfolio-ready projects." },
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number]["id"];
export const CATEGORY_IDS = COURSE_CATEGORIES.map((c) => c.id) as [CourseCategory, ...CourseCategory[]];

export function categoryLabel(id?: string | null) {
  return COURSE_CATEGORIES.find((c) => c.id === id)?.label;
}

export function isCategory(id: unknown): id is CourseCategory {
  return typeof id === "string" && COURSE_CATEGORIES.some((c) => c.id === id);
}
