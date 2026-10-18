import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { getProtectedMediaUrl } from "@/services/uploads";

type P = { lessonId: string };

/** Enrollment-checked redirect to a freshly signed Cloudinary URL for the lesson video. */
export const GET = handler<undefined, P>({ auth: "any" }, async ({ user, params }) => {
  const url = await getProtectedMediaUrl(user!, params.lessonId);
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
});
