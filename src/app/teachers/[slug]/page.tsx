import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeacherProfileView } from "@/components/teacher-profile-view";
import { connectDB } from "@/lib/db";
import { listPublishedCourses } from "@/services/courses";
import { getPublicTeacherProfile } from "@/services/teacher-profile";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectDB();
  const found = await getPublicTeacherProfile(slug);
  if (!found) return { title: "Teacher not found", robots: { index: false } };
  const p = found.profile;
  const description = (p.shortBio || p.headline || `${p.displayName} teaches at Onkur.`).slice(0, 160);
  return {
    title: `${p.displayName} — Teacher`,
    description,
    alternates: { canonical: `/teachers/${p.slug}` },
    openGraph: { title: `${p.displayName} — Onkur teacher`, description, type: "profile", ...(p.photoUrl ? { images: [{ url: p.photoUrl, alt: p.displayName }] } : {}) },
  };
}

export default async function TeacherProfilePage({ params }: Props) {
  const { slug } = await params;
  await connectDB();
  const found = await getPublicTeacherProfile(slug);
  if (!found) notFound();
  const { profile, courseIds } = found;
  // Only the published courses this teacher is linked to.
  const courses = courseIds.length ? await listPublishedCourses({ onlyIds: courseIds }) : [];

  return <TeacherProfileView profile={profile} courses={courses} />;
}
