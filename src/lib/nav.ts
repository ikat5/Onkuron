/** Navigation shared by the server header and the client menus. */
export const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/teachers", label: "Meet Our Teachers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact Us" },
];

export type Viewer = { role: "student" | "teacher"; name: string } | null;

export function dashboardFor(viewer: Viewer) {
  return viewer?.role === "teacher" ? { href: "/admin", label: "Admin Panel" } : { href: "/dashboard", label: "Student Dashboard" };
}
