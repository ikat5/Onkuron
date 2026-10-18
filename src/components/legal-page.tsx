import type { ReactNode } from "react";
import { Container } from "./ui";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <section className="bg-night-900 text-white">
        <Container className="py-14">
          <p className="eyebrow text-sun-400">Legal</p>
          <h1 className="mt-3 text-4xl font-extrabold">{title}</h1>
          <p className="mt-2 text-sm text-brand-100/70">Last updated: {updated}</p>
        </Container>
      </section>
      <Container className="py-12">
        <article className="card mx-auto max-w-3xl space-y-6 p-6 leading-relaxed text-ink sm:p-10 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-ink/90 [&_ul]:space-y-1.5">
          {children}
        </article>
      </Container>
    </>
  );
}
