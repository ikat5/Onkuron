import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "left",
  tone = "light",
  action,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  action?: ReactNode;
  id?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={`mb-10 flex flex-col gap-4 ${align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between"}`}>
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow && <p className={`eyebrow mb-3 ${dark ? "text-sun-400" : "text-leaf-600"}`}>{eyebrow}</p>}
        <h2 id={id} className={`text-3xl leading-tight font-extrabold sm:text-4xl ${dark ? "text-white" : "text-ink"}`}>
          {title}
        </h2>
        {children && <div className={`mt-3 text-base leading-relaxed sm:text-lg ${dark ? "text-brand-100/80" : "text-muted"}`}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
