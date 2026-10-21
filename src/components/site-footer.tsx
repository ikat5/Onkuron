import Image from "next/image";
import Link from "next/link";
import { COURSE_CATEGORIES } from "@/lib/categories";
import { Icon } from "./icons";

const CONTACT_EMAIL = "info.onkuron@gmail.com";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "All courses" },
      ...COURSE_CATEGORIES.slice(0, 4).map((c) => ({ href: `/courses?category=${c.id}`, label: c.label })),
    ],
  },
  {
    title: "Onkur",
    links: [
      { href: "/teachers", label: "Meet Our Teachers" },
      { href: "/developers", label: "Meet Our Developer Team" },
      { href: "/editors", label: "Meet Our Video Editor Team" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/dashboard", label: "Student dashboard" },
      { href: "/login", label: "Student login" },
      { href: "/register", label: "Create an account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-16 overflow-hidden bg-night-900 text-brand-100">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[28rem] rounded-full bg-brand-600/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 left-[-10%] size-[26rem] rounded-full bg-leaf-500/15 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="inline-flex rounded-xl bg-white px-4 py-2" aria-label="Onkur home">
              <Image src="/brand/logo-wordmark-transparent.png" alt="অঙ্কুরণ" width={120} height={64} className="h-11 w-auto" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-100/80">
              Onkur (অঙ্কুরণ) is an online learning platform for HSC ICT and modern web development — structured video lessons, practical resources and teachers who answer your questions.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 transition group-hover:bg-sun-500 group-hover:text-ink">
                <Icon name="mail" />
              </span>
              <span className="underline-offset-4 group-hover:underline">{CONTACT_EMAIL}</span>
            </a>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="eyebrow mb-4 text-sun-400">{col.title}</p>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="inline-flex items-center gap-1 text-brand-100/80 transition hover:translate-x-0.5 hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-brand-100/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Onkur (অঙ্কুরণ). All rights reserved.</p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms and Conditions
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
