import Image from "next/image";
import Link from "next/link";
import { TEAMS } from "@/lib/team";
import type { PublicTeacherProfile } from "@/services/teacher-profile";
import { Icon } from "./icons";

export function TeacherAvatar({ profile, className = "", initialSize = "text-5xl" }: { profile: Pick<PublicTeacherProfile, "photoUrl" | "displayName">; className?: string; initialSize?: string }) {
  return profile.photoUrl ? (
    <Image src={profile.photoUrl} alt={`Photo of ${profile.displayName}`} fill sizes="(min-width: 1024px) 400px, 100vw" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-600 to-night-800 ${className}`}>
      <span className={`font-display font-extrabold text-white/90 ${initialSize}`}>{profile.displayName.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

/** Public profile card (any team): one link, showing only published profile fields. */
export function TeacherCard({ profile }: { profile: PublicTeacherProfile }) {
  const cfg = TEAMS[profile.team];
  return (
    <Link href={`${cfg.publicPath}/${profile.slug}`} className="card lift group flex h-full flex-col overflow-hidden hover:border-brand-200 sm:flex-row">
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-auto sm:w-2/5">
        <TeacherAvatar profile={profile} className="transition duration-500 ease-out-soft group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow text-leaf-600">{cfg.singular}</p>
        <h3 className="mt-1 text-2xl font-extrabold text-ink group-hover:text-brand-700">{profile.displayName}</h3>
        {profile.headline && <p className="mt-1 text-sm font-semibold text-brand-600">{profile.headline}</p>}
        {profile.shortBio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{profile.shortBio}</p>}
        {profile.subjects.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={cfg.subjectsLabel}>
            {profile.subjects.slice(0, 5).map((s) => (
              <li key={s} className="badge bg-brand-50 text-brand-700">
                {s}
              </li>
            ))}
          </ul>
        )}
        {profile.achievements.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-ink">
            {profile.achievements.slice(0, 2).map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <Icon name="trophy" className="mt-0.5 size-4 text-sun-600" />
                <span>
                  {a.title}
                  {a.year ? <span className="text-muted"> · {a.year}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-brand-700">
          View profile <Icon name="right" className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
