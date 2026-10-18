import Link from "next/link";
import type { ReactNode } from "react";

export function formatTaka(amount: number) {
  return `৳${amount.toLocaleString("en-IN")}`;
}

export function formatDate(d: Date | string | undefined, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Dhaka",
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const TONES = {
  info: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-leaf-100 bg-leaf-50 text-leaf-700",
  warning: "border-sun-100 bg-sun-50 text-sun-700",
  error: "border-red-200 bg-red-50 text-red-800",
} as const;

export function Alert({ tone = "info", title, children }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "bg-sun-100 text-sun-700",
  approved: "bg-leaf-100 text-leaf-700",
  rejected: "bg-red-100 text-red-700",
  sent: "bg-leaf-100 text-leaf-700",
  sending: "bg-brand-100 text-brand-700",
  failed: "bg-sun-100 text-sun-700",
  dead: "bg-red-100 text-red-700",
  published: "bg-leaf-100 text-leaf-700",
  draft: "bg-slate-100 text-slate-700",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${STATUS[status] ?? "bg-slate-100 text-slate-700"}`}>{label ?? status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-brand-700 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, href, cta }: { title: string; children?: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-full bg-leaf-50 text-2xl">🌱</div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {href && cta && (
        <Link href={href} className="btn-primary mt-4">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}
