import Link from "next/link";
import type { PublicTeacherProfile } from "@/services/teacher-profile";
import { Icon } from "./icons";
import { TeacherAvatar } from "./teacher-card";

/** "Instructor of ICT & Physics" from the first subjects; "HSC " / "SSC " prefixes are dropped to keep it short. */
function subjectLabel(subjects: string[]) {
  const names = [...new Set(subjects.slice(0, 2).map((s) => s.replace(/^(hsc|ssc)\s+/i, "")))];
  return names.length ? `Instructor of ${names.join(" & ")}` : "Onkur instructor";
}

/**
 * Homepage instructor card: framed portrait overlapping the card top, then
 * name, qualification, position, social links, subject and a link to the
 * teacher's courses. Optional fields are simply left out when empty.
 */
export function InstructorCard({ profile }: { profile: PublicTeacherProfile }) {
  const href = `/teachers/${profile.slug}`;
  const position = profile.headline || profile.achievements[0]?.title;
  const socials = [
    profile.facebookUrl && { href: profile.facebookUrl, icon: "facebook" as const, label: "Facebook", tone: "hover:bg-[#1877f2] hover:text-white" },
    profile.youtubeChannelUrl && { href: profile.youtubeChannelUrl, icon: "youtube" as const, label: "YouTube", tone: "hover:bg-[#ff0000] hover:text-white" },
  ].filter(Boolean) as Array<{ href: string; icon: "facebook" | "youtube"; label: string; tone: string }>;

  return (
    <article className="group relative h-full pt-16">
      <div className="relative flex h-full flex-col items-center rounded-[1.5rem] border border-line bg-white px-5 pb-5 text-center shadow-[0_1px_2px_rgb(23_32_51/0.04),0_18px_40px_-24px_rgb(21_85_164/0.35)] transition duration-300 ease-out-soft group-hover:-translate-y-1 group-hover:border-brand-200 group-hover:shadow-[0_1px_2px_rgb(23_32_51/0.04),0_28px_56px_-24px_rgb(21_85_164/0.45)] sm:px-6 sm:pb-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[1.5rem] bg-gradient-to-b from-brand-50 to-transparent" />

        {/* Portrait frame, lifted half out of the card. */}
        <Link href={href} tabIndex={-1} aria-hidden className="relative -mt-16 block rounded-[1.75rem] bg-gradient-to-br from-brand-500 via-brand-600 to-leaf-500 p-1 shadow-[0_18px_36px_-16px_rgb(13_57_109/0.55)]">
          <span className="block rounded-[1.5rem] bg-white p-1">
            <span className="relative block size-32 overflow-hidden rounded-[1.25rem] sm:size-36">
              <TeacherAvatar profile={profile} className="transition duration-500 ease-out-soft group-hover:scale-105" initialSize="text-4xl" />
            </span>
          </span>
        </Link>

        <h3 className="relative mt-4 text-xl leading-snug font-extrabold text-ink">
          <Link href={href} className="rounded-sm hover:text-brand-700">
            {profile.displayName}
          </Link>
        </h3>
        {profile.qualification && (
          <p className="relative mt-1.5 flex items-start justify-center gap-1.5 text-sm leading-snug font-medium text-ink/80">
            <Icon name="cap" className="mt-px size-4 text-brand-600" />
            <span>{profile.qualification}</span>
          </p>
        )}
        {position && <p className="relative mt-1 text-sm leading-snug text-muted">{position}</p>}

        {socials.length > 0 && (
          <ul className="relative mt-3 flex justify-center gap-2" aria-label={`${profile.displayName} on social media`}>
            {socials.map((s) => (
              <li key={s.icon}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${profile.displayName} on ${s.label} (opens in a new tab)`}
                  className={`flex size-9 items-center justify-center rounded-full border border-line bg-white text-muted transition duration-200 ${s.tone}`}
                >
                  <Icon name={s.icon} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-700">
          <Icon name="book" className="size-3.5" />
          {subjectLabel(profile.subjects)}
        </p>

        <div className="relative mt-auto w-full pt-5">
          <Link href={`/courses?teacher=${profile.slug}`} className="btn-primary w-full py-3">
            <Icon name="cart" className="size-[18px]" /> All Courses
            <span className="sr-only"> by {profile.displayName}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
