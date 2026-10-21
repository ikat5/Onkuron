import { Icon } from "@/components/icons";
import { Container } from "@/components/ui";
import { INTERACTIVE_SECTION as COPY } from "@/lib/interactive";
import type { PublicTopic } from "@/services/interactive";
import { IctLab } from "./ict-lab/ict-lab";

/**
 * "Experience HSC ICT Through Interactive Visual Learning": the published
 * interactive topics (/admin/interactive) running live in the HSC ICT lab.
 */
export function InteractiveLearning({ topics }: { topics: PublicTopic[] }) {
  return (
    <section id="interactive-learning" aria-labelledby="interactive-title" className="relative scroll-mt-20 overflow-hidden bg-canvas py-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      <Container className="relative">
        <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center text-center">
          <p className="eyebrow mb-3 inline-flex items-center gap-2 text-leaf-600">
            <Icon name="sparkle" className="size-4" /> HSC ICT Lab
          </p>
          <h2 id="interactive-title" className="text-3xl leading-tight font-extrabold text-balance text-ink sm:text-4xl">
            {COPY.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{COPY.text}</p>
        </div>
        <IctLab topics={topics} />
      </Container>
    </section>
  );
}
