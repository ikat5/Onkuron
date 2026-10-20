import Image from "next/image";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { Icon } from "./icons";
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

/** The whole card is one link (no nested interactive elements). */
export function CourseCard({ course, priority = false }: { course: CourseCardData; priority?: boolean }) {
  const category = categoryLabel(course.category);
  const students = Math.max(MIN_SHOWN_STUDENTS, course.studentCount ?? 0);
  return (
    <Link href={`/courses/${course.slug}`} className="card lift group flex h-full flex-col overflow-hidden hover:border-brand-200">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-night-800">
        {course.thumbnail?.url ? (
          <Image
            src={course.thumbnail.url}
            alt={`${course.title} course thumbnail`}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 ease-out-soft group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <p className="font-display text-center text-xl font-bold text-white/90 transition duration-500 group-hover:scale-105">{course.title}</p>
          </div>
        )}
        {category && <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-brand-700 shadow-sm">{category}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg leading-snug font-bold text-ink transition-colors group-hover:text-brand-700">{course.title}</h3>
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
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
            View course <Icon name="right" className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
