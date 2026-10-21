import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { categoryIcon } from "@/lib/categories";
import type { PublicCategory } from "@/services/categories";

/** Accent per card, cycled so neighbouring subjects are easy to tell apart. */
const TINTS = [
  { tile: "bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white", bar: "from-brand-500 to-brand-700" },
  { tile: "bg-leaf-50 text-leaf-700 group-hover:bg-leaf-600 group-hover:text-white", bar: "from-leaf-500 to-leaf-700" },
  { tile: "bg-sun-50 text-sun-700 group-hover:bg-sun-500 group-hover:text-ink", bar: "from-sun-400 to-sun-600" },
];

/**
 * "What would you like to learn?": one box per published subject category
 * (managed at /admin/categories), in the admin's order and centred when
 * there are only a few. Each box opens the course catalogue filtered to that
 * subject.
 */
export function LearningDiscovery({ categories }: { categories: PublicCategory[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {categories.map((c, i) => {
        const tint = TINTS[i % TINTS.length];
        return (
          <li key={c.slug} className="w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]">
            <Link
              href={`/courses?category=${c.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5 transition duration-300 ease-out-soft hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift focus-visible:-translate-y-1 motion-reduce:hover:translate-y-0"
            >
              <span aria-hidden className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-500 ease-out-soft group-hover:scale-x-100 ${tint.bar}`} />
              <span className="flex items-start justify-between gap-3">
                {c.imageUrl ? (
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:size-12">
                    <Image src={c.imageUrl} alt="" fill sizes="(min-width: 640px) 48px, 40px" className="object-cover" />
                  </span>
                ) : (
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:-rotate-6 sm:size-12 ${tint.tile}`}>
                    <Icon name={categoryIcon(c.icon)} className="size-5 sm:size-6" />
                  </span>
                )}
                {c.label && <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[11px] font-bold text-sun-700 sm:px-2.5">{c.label}</span>}
              </span>
              <span className="mt-3 font-display text-base leading-snug font-bold sm:mt-4 sm:text-lg text-ink transition-colors group-hover:text-brand-700">{c.name}</span>
              {c.description && <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted max-sm:hidden">{c.description}</span>}
              <span className="mt-auto flex items-center justify-between gap-2 pt-4 sm:pt-5">
                <span className="text-xs font-semibold text-leaf-700">{c.courseCount > 0 ? `${c.courseCount} course${c.courseCount === 1 ? "" : "s"}` : "Courses coming soon"}</span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition duration-300 group-hover:border-brand-600 sm:size-8 group-hover:bg-brand-600 group-hover:text-white">
                  <Icon name="right" className="size-4" />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
