import Image from "next/image";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-50 via-white to-leaf-50 px-6 pt-6 pb-4 text-center">
          <Image src="/brand/logo-wordmark-transparent.png" alt="অঙ্কুরণ" width={140} height={75} className="mx-auto h-14 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-brand-700">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="px-6 pt-4 pb-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
