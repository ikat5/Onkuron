import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

/** Course title band with the back link and the student's overall progress. Hook-free, so usable from server and client. */
export function CourseHeader({
  title,
  backHref,
  backLabel,
  completed,
  total,
  teacherPreview,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  completed: number;
  total: number;
  teacherPreview?: boolean;
  children?: ReactNode;
}) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <Icon name="left" /> {backLabel}
        </Link>
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-bold text-brand-700 sm:text-2xl">{title}</h1>
          {teacherPreview ? (
            <span className="badge self-start bg-sun-100 text-sun-700 md:self-auto">Teacher preview — progress isn&apos;t tracked</span>
          ) : (
            <div className="w-full md:w-72">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-ink">{`${completed} of ${total} lessons complete`}</span>
                <span className="font-semibold text-leaf-700">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-leaf-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
                <div className="h-full rounded-full bg-leaf-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
