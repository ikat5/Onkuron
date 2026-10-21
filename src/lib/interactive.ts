/**
 * Interactive HSC ICT lessons. Topic text lives in the database
 * (InteractiveTopic, managed at /admin/interactive); each topic points at one
 * of the built-in interactive modules below (src/components/home/ict-lab/).
 * Adding a new module means adding a component and an entry here.
 */

export const INTERACTIVE_MODULES = ["logic", "adder", "html", "c", "database"] as const;
export type InteractiveModule = (typeof INTERACTIVE_MODULES)[number];

export const MODULE_LABELS: Record<InteractiveModule, string> = {
  logic: "Logic gates simulator",
  adder: "Half & full adder circuit",
  html: "HTML page builder",
  c: "C program tracer",
  database: "SQL query playground",
};

export function isInteractiveModule(m: unknown): m is InteractiveModule {
  return typeof m === "string" && (INTERACTIVE_MODULES as readonly string[]).includes(m);
}

export const INTERACTIVE_SECTION = {
  title: "Experience HSC ICT Through Interactive Visual Learning",
  text: "Understand complex ICT concepts through engaging visual demonstrations, interactive simulations, and hands-on learning experiences. Explore topics step by step, visualize how technology works, and turn difficult concepts into knowledge you can confidently apply in your exams and beyond.",
};

/** Starter topics seeded once into an empty database (the five labs that shipped with the site). */
export const DEFAULT_TOPICS: Array<{ slug: string; title: string; chapter: string; chapterBn: string; glyph: string; learn: string[]; module: InteractiveModule }> = [
  {
    slug: "logic-gates",
    title: "Boolean algebra & logic gates",
    chapter: "Chapter 3",
    chapterBn: "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস",
    glyph: "A·B",
    learn: ["AND, OR, NOT, NAND, NOR, XOR gates", "Truth tables", "De Morgan's theorems and simplification"],
    module: "logic",
  },
  {
    slug: "half-full-adder",
    title: "Half adder & full adder",
    chapter: "Chapter 3",
    chapterBn: "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস",
    glyph: "Σ",
    learn: ["How computers add binary numbers", "Sum and carry logic", "Building a full adder from half adders"],
    module: "adder",
  },
  {
    slug: "html-web-design",
    title: "Web design with HTML",
    chapter: "Chapter 4",
    chapterBn: "ওয়েব ডিজাইন পরিচিতি এবং HTML",
    glyph: "</>",
    learn: ["Tags, elements and attributes", "Headings, lists, links and tables", "Building your own web page"],
    module: "html",
  },
  {
    slug: "c-programming",
    title: "C programming",
    chapter: "Chapter 5",
    chapterBn: "প্রোগ্রামিং ভাষা",
    glyph: "{ }",
    learn: ["Variables, data types and operators", "Conditions and loops", "Tracing a program line by line"],
    module: "c",
  },
  {
    slug: "database-sql",
    title: "Database & SQL",
    chapter: "Chapter 6",
    chapterBn: "ডেটাবেজ ম্যানেজমেন্ট সিস্টেম",
    glyph: "SQL",
    learn: ["Tables, fields, records and primary keys", "SELECT, WHERE and ORDER BY", "Searching, sorting and COUNT"],
    module: "database",
  },
];
