"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const NAV: Array<{ href: string; label: string; icon: IconName; group: string }> = [
  { href: "/admin", label: "Overview", icon: "grid", group: "Teaching" },
  { href: "/admin/courses", label: "Courses", icon: "book", group: "Teaching" },
  { href: "/admin/enrollments", label: "Enrollments", icon: "receipt", group: "Students" },
  { href: "/admin/messages", label: "Messages", icon: "chat", group: "Students" },
  { href: "/admin/teachers", label: "Teachers", icon: "user", group: "Public site" },
  { href: "/admin/settings", label: "Settings & intro video", icon: "settings", group: "Public site" },
  { href: "/admin/emails", label: "Email log", icon: "mail", group: "Records" },
  { href: "/admin/audit", label: "Audit log", icon: "shield", group: "Records" },
];

export function TeacherNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-5 lg:px-0">
      {groups.map((g) => (
        <div key={g} className="contents lg:block">
          <p className="hidden px-3 pb-1.5 text-[11px] font-bold tracking-[0.14em] text-muted uppercase lg:block">{g}</p>
          {NAV.filter((n) => n.group === g).map((n) => {
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  on ? "bg-brand-600 text-white shadow-sm" : "text-ink hover:bg-white hover:text-brand-700 hover:shadow-sm"
                }`}
              >
                <Icon name={n.icon} className={`size-4 transition-transform group-hover:scale-110 ${on ? "text-white" : "text-muted group-hover:text-brand-600"}`} />
                {n.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
