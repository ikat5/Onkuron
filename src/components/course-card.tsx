import Image from "next/image";
import Link from "next/link";
import { categoryIcon, categoryLabel } from "@/lib/categories";
import { Icon } from "./icons";
import { TiltCard } from "./tilt-card";
import { formatTaka } from "./ui";

export interface CourseCardData {
  slug: string;
  title: string;
  summary: string;
  price: number;
  lessonCount: number;
  /** Approved enrollments; the card always shows at least MIN_SHOWN_STUDENTS. */
  studentCount?: number;
  category?: string;
  thumbnail?: { url?: string };
}

const MIN_SHOWN_STUDENTS = 50;

/**
 * The whole card is one link (no nested interactive elements). Depth layers:
 * surface → artwork (raised, parallax image, pointer light) → category badge and
 * subject chip (floating highest) → text (slightly raised). See TiltCard.
 * `index` staggers the entrance animation across a grid row.
 */
export function CourseCard({ course, priority = false, index = 0 }: { course: CourseCardData; priority?: boolean; index?: number }) {
  const category = categoryLabel(course.category);
  const students = Math.max(MIN_SHOWN_STUDENTS, course.studentCount ?? 0);
  return (
    <TiltCard index={index} className="h-full">
      <Link href={`/courses/${course.slug}`} className="tilt-body card group flex h-full flex-col p-2.5 sm:p-3">
        <div className="tilt-stage">
          <div className="tilt-art relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 via-brand-600 to-night-800">
            <div className="tilt-parallax absolute inset-0">
              {course.thumbnail?.url ? (
                <Image src={course.thumbnail.url} alt={`${course.title} course thumbnail`} fill priority={priority} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              ) : (
                <div aria-hidden className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
                  <Icon name={categoryIcon(course.category)} className="relative size-16 text-white/80 drop-shadow-lg" />
                </div>
              )}
            </div>
            <span aria-hidden className="tilt-glare" />
          </div>
          {category && <span className="tilt-float-1 absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-brand-700 shadow-md">{category}</span>}
          <span aria-hidden className="tilt-float-2 absolute right-4 -bottom-5 flex size-11 items-center justify-center rounded-xl bg-white text-brand-700 shadow-lg ring-1 ring-line transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
            <Icon name={categoryIcon(course.category)} className="size-5" />
          </span>
        </div>
        <div className="tilt-text flex flex-1 flex-col px-2 pt-6 pb-2 sm:px-2.5">
          <h3 className="pr-12 text-lg leading-snug font-bold text-ink transition-colors group-hover:text-brand-700">{course.title}</h3>
          {course.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{course.summary}</p>}
          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <div>
              <p className="text-2xl font-extrabold text-ink">{formatTaka(course.price)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Icon name="video" className="size-3.5" /> {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="users" className="size-3.5" /> {students.toLocaleString("en-US")} students
                </span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
              View course <Icon name="right" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
