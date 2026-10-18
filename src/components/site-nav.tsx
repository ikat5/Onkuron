"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { dashboardFor, PUBLIC_LINKS, type Viewer } from "@/lib/nav";
import { LogoutButton } from "./logout-button";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop links with active state. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {PUBLIC_LINKS.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-sun-500 after:transition-transform after:duration-300 ${
              active ? "text-brand-700 after:scale-x-100" : "text-ink/80 after:scale-x-0 hover:text-brand-700 hover:after:scale-x-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Hamburger menu for small screens. */
export function MobileNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Close after navigating (state adjustment during render, no effect needed).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dash = dashboardFor(viewer);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex size-10 items-center justify-center rounded-lg border border-line text-ink hover:bg-brand-50"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <Icon name="x" className="size-5" /> : <Icon name="menu" className="size-5" />}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b border-line bg-white shadow-lg">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {PUBLIC_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 text-base font-semibold ${active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-canvas"}`}
                >
                  {l.label}
                  <Icon name="right" className="size-4 text-muted" />
                </Link>
              );
            })}
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              {viewer ? (
                <>
                  <Link href={dash.href} className="btn-primary py-3">
                    {dash.label}
                  </Link>
                  {viewer.role === "student" && (
                    <Link href="/dashboard/messages" className="btn-outline py-3">
                      Messages
                    </Link>
                  )}
                  <LogoutButton className="btn-outline py-3" />
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-outline py-3">
                    Login
                  </Link>
                  <Link href="/courses" className="btn-sun py-3">
                    Explore Courses
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
