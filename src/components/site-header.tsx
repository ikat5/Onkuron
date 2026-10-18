import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, type SessionUser } from "@/lib/auth/current";
import { LogoutButton } from "./logout-button";
import { dashboardFor } from "@/lib/nav";
import { DesktopNav, MobileNav } from "./site-nav";

async function safeUser(): Promise<SessionUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null; // The header must render even if the database is unreachable.
  }
}

export async function SiteHeader() {
  const user = await safeUser();
  const viewer = user ? { role: user.role === "teacher" ? ("teacher" as const) : ("student" as const), name: user.name } : null;
  const dash = dashboardFor(viewer);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div aria-hidden className="flex h-1">
        <span className="w-3/5 bg-brand-600" />
        <span className="w-1/4 bg-leaf-500" />
        <span className="flex-1 bg-sun-500" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center rounded-lg" aria-label="Onkur home">
          <Image src="/brand/logo-wordmark-transparent.png" alt="অঙ্কুরণ" width={120} height={64} priority className="h-11 w-auto" />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-2">
          {viewer ? (
            <div className="hidden items-center gap-2 lg:flex">
              {viewer.role === "student" && (
                <Link href="/dashboard/messages" className="rounded-md px-2 py-2 text-sm font-semibold text-ink/80 hover:text-brand-700">
                  Messages
                </Link>
              )}
              <Link href={dash.href} className="btn-primary">
                {dash.label}
              </Link>
              <LogoutButton className="btn-outline px-3" />
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/login" className="btn-outline">
                Login
              </Link>
              <Link href="/courses" className="btn-sun">
                Explore Courses
              </Link>
            </div>
          )}
          {/* Compact primary action on phones/tablets next to the menu button. */}
          <Link href={viewer ? dash.href : "/courses"} className={`${viewer ? "btn-primary" : "btn-sun"} hidden px-3 sm:inline-flex lg:hidden`}>
            {viewer ? "Dashboard" : "Explore Courses"}
          </Link>
          <MobileNav viewer={viewer} />
        </div>
      </div>
    </header>
  );
}
