/**
 * Controlled course categories. A small fixed list (not a database model):
 * the teacher picks one per course and the catalogue filters on it.
 */
export const COURSE_CATEGORIES = [
  { id: "hsc-ict", label: "HSC ICT", blurb: "Computer fundamentals, number systems, networking, databases and the full HSC ICT syllabus." },
  { id: "hsc-physics", label: "HSC Physics", blurb: "Mechanics, waves, electricity and modern physics — concepts and problem solving for HSC." },
  { id: "hsc-chemistry", label: "HSC Chemistry", blurb: "Physical, inorganic and organic chemistry with clear reactions and worked problems." },
  { id: "hsc-math", label: "HSC Math", blurb: "Higher math for HSC: algebra, trigonometry, calculus and more, step by step." },
  { id: "hsc-biology", label: "HSC Biology", blurb: "Botany and zoology for HSC, with diagrams and exam-focused explanations." },
  { id: "ssc-ict", label: "SSC ICT", blurb: "The SSC ICT syllabus: computer basics, the internet, programming ideas and more." },
  { id: "ssc-physics", label: "SSC Physics", blurb: "Build a strong base in motion, force, energy, light and electricity for SSC." },
  { id: "ssc-math", label: "SSC Math", blurb: "General and higher math for SSC, explained clearly with plenty of practice." },
  { id: "ssc-biology", label: "SSC Biology", blurb: "Cells, life processes and the human body — the SSC biology syllabus made simple." },
  { id: "programming", label: "Programming Fundamentals", blurb: "Think like a programmer: logic, C and problem solving from first principles." },
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
