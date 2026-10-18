import "server-only";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/current";
import { getCourseForLearner } from "@/services/learning";

/** Loads protected course content for a learn page; enrollment is checked server-side before anything is returned. */
export async function loadLearnerCourse(user: SessionUser, slug: string) {
  try {
    return await getCourseForLearner(user, { slug });
  } catch (err) {
    if (err instanceof AppError && err.status === 403) return "forbidden" as const;
    if (err instanceof AppError && err.status === 404) return "missing" as const;
    throw err;
  }
}
