"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

const INTERVAL_MS = 6500;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

/* ---------- Panel 1: HSC ICT ---------- */
function IctPanel() {
  const bits = ["1", "0", "1", "1"];
  return (
    <div className="grid h-full grid-cols-[1.1fr_1fr] gap-4 p-5 sm:p-6">
      <div className="relative flex items-center justify-center rounded-2xl border border-white/10 bg-night-800/80">
        {/* CPU with traces */}
        <div className="relative size-28 sm:size-32">
          {[0, 1, 2, 3].map((i) => (
            <span key={`t${i}`} className="absolute top-1/2 h-px w-[140%] -translate-y-1/2 bg-gradient-to-r from-transparent via-brand-300/50 to-transparent" style={{ left: "-20%", transform: `translateY(-50%) rotate(${i * 45}deg)` }} />
          ))}
          <div className="relative flex size-full items-center justify-center rounded-xl border-2 border-brand-300/70 bg-gradient-to-br from-brand-600 to-brand-800 shadow-[0_0_40px_-6px] shadow-brand-500">
            <Icon name="chip" className="size-12 text-white" />
          </div>
          {[0, 1, 2].map((i) => (
            <span key={`p${i}`} className="absolute size-2 animate-pulse-soft rounded-full bg-sun-400" style={{ top: `${15 + i * 35}%`, left: i % 2 ? "-12%" : "104%", animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-semibold tracking-wider text-brand-200 uppercase">Number system</p>
          <p className="mt-1 flex items-center gap-1 font-mono text-lg font-bold text-white">
            {bits.map((b, i) => (
              <span key={i} className="animate-fade-up" style={{ animationDelay: `${0.3 + i * 0.25}s` }}>
                {b}
              </span>
            ))}
            <sub className="text-xs text-brand-200">2</sub>
            <span className="mx-1 text-brand-200">=</span>
            <span className="animate-fade-up text-sun-400" style={{ animationDelay: "1.5s" }}>
              11
            </span>
            <sub className="text-xs text-brand-200">10</sub>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-semibold tracking-wider text-brand-200 uppercase">Logic gate · AND</p>
          <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-xs text-white">
            {[
              ["A", "B", "Y"],
              ["0", "1", "0"],
              ["1", "1", "1"],
            ].map((row, r) =>
              row.map((c, i) => (
                <span key={`${r}${i}`} className={`rounded px-1.5 py-0.5 text-center ${r === 0 ? "text-brand-200" : i === 2 ? "bg-leaf-500/30 text-leaf-100" : "bg-white/5"}`}>
                  {c}
                </span>
              )),
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white">
          <Icon name="server" className="size-4 text-leaf-400" /> Networking · Database · C
        </div>
      </div>
    </div>
  );
}

/* ---------- Panel 2: Web development ---------- */
const CODE = [
  { indent: 0, parts: [["text-sun-400", "function "], ["text-leaf-400", "Course"], ["text-white", "() {"]] },
  { indent: 1, parts: [["text-sun-400", "return "], ["text-white", "("]] },
  { indent: 2, parts: [["text-brand-300", "<h1>"], ["text-white", "Learn. Build."], ["text-brand-300", "</h1>"]] },
  { indent: 2, parts: [["text-brand-300", "<Button "], ["text-leaf-400", "primary"], ["text-brand-300", " />"]] },
  { indent: 1, parts: [["text-white", ");"]] },
  { indent: 0, parts: [["text-white", "}"]] },
] as const;

function WebPanel() {
  return (
    <div className="grid h-full grid-cols-[1.15fr_1fr] gap-4 p-5 sm:p-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-950/90">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-sun-400/80" />
          <span className="size-2.5 rounded-full bg-leaf-400/80" />
          <span className="ml-2 font-mono text-[10px] text-brand-200">course.tsx</span>
        </div>
        <pre className="p-3 font-mono text-[11px] leading-6 sm:text-xs">
          {CODE.map((line, i) => (
            <div key={i} className="animate-fade-up whitespace-nowrap" style={{ animationDelay: `${0.2 + i * 0.35}s`, paddingLeft: `${line.indent}rem` }}>
              {line.parts.map(([cls, txt], j) => (
                <span key={j} className={cls}>
                  {txt}
                </span>
              ))}
              {i === CODE.length - 1 && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-caret bg-sun-400 align-middle" />}
            </div>
          ))}
        </pre>
      </div>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white">
        <div className="flex items-center gap-1 border-b border-line bg-canvas px-2 py-1.5">
          <span className="h-3 flex-1 rounded-full bg-white px-2 font-mono text-[8px] leading-3 text-muted ring-1 ring-line">localhost:3000</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 p-3">
          <div className="h-2 w-1/3 rounded-full bg-brand-100" />
          <p className="animate-fade-up font-display text-base leading-tight font-extrabold text-ink" style={{ animationDelay: "1.2s" }}>
            Learn. Build.
          </p>
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-line" />
            <div className="h-1.5 w-4/5 rounded-full bg-line" />
          </div>
          <span className="animate-fade-up mt-1 w-fit rounded-md bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white" style={{ animationDelay: "1.6s" }}>
            Primary
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Panel 3: Learning growth ---------- */
const STEPS = [
  { label: "Beginner", icon: "sprout" as const },
  { label: "Practice", icon: "code" as const },
  { label: "Projects", icon: "layers" as const },
  { label: "Developer", icon: "rocket" as const },
];

function GrowthPanel() {
  return (
    <div className="flex h-full flex-col justify-center gap-6 p-5 sm:p-8">
      <div className="relative">
        <div className="absolute top-6 right-6 left-6 h-1 rounded-full bg-white/10" />
        <div className="absolute top-6 left-6 h-1 origin-left rounded-full bg-gradient-to-r from-leaf-400 via-sun-400 to-sun-500 transition-[width] duration-[2500ms] ease-out-soft" style={{ width: "calc(100% - 3rem)", animation: "grow 2.6s var(--ease-out-soft) both" }} />
        <ol className="relative flex justify-between">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex flex-col items-center gap-2">
              <span className="animate-fade-up flex size-12 items-center justify-center rounded-full border-2 border-white/20 bg-night-800 text-white shadow-lg" style={{ animationDelay: `${0.3 + i * 0.5}s` }}>
                <Icon name={s.icon} className={`size-5 ${i === STEPS.length - 1 ? "text-sun-400" : "text-leaf-400"}`} />
              </span>
              <span className="text-[11px] font-semibold text-brand-100 sm:text-xs">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Lessons", "Structured"],
          ["Resources", "Notes & slides"],
          ["Progress", "Tracked"],
        ].map(([k, v], i) => (
          <div key={k} className="animate-fade-up rounded-xl border border-white/10 bg-white/5 p-3 text-center" style={{ animationDelay: `${1.8 + i * 0.2}s` }}>
            <p className="text-[10px] tracking-wider text-brand-200 uppercase">{k}</p>
            <p className="mt-0.5 text-sm font-bold text-white">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PANELS = [
  { id: "ict", tab: "HSC ICT", caption: "HSC ICT, made visual", sub: "Number systems, logic gates, networking and C programming explained step by step.", Panel: IctPanel },
  { id: "web", tab: "Web development", caption: "From code to a real website", sub: "HTML, CSS, JavaScript, React and Next.js — see what you write come alive.", Panel: WebPanel },
  { id: "growth", tab: "Your growth", caption: "Beginner to builder", sub: "Practise with every lesson and track your progress through each course.", Panel: GrowthPanel },
];

/**
 * Always-visible animated showcase. Rotates calmly between three panels,
 * can be paused, and stops rotating for reduced-motion users (who can still
 * switch panels with the tabs). Captions stay readable and are real text.
 */
export function HeroShowcase() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const rotating = !reduced && !paused && !hovering;

  useEffect(() => {
    if (!rotating) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % PANELS.length), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [rotating, index]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What you can learn at Onkur"
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-500/40 via-leaf-500/20 to-sun-500/30 opacity-70 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-night-800 via-brand-900 to-night-900 shadow-2xl">
        <div className="relative aspect-[16/11] sm:aspect-[16/10]">
          {PANELS.map((p, i) => {
            const active = i === index;
            return (
              <div
                key={p.id}
                id={`showcase-${p.id}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${PANELS.length}: ${p.tab}`}
                aria-hidden={!active}
                inert={!active}
                className={`absolute inset-0 transition-all duration-700 ease-out-soft ${active ? "scale-100 opacity-100" : "pointer-events-none scale-[0.98] opacity-0"}`}
              >
                {/* Remount on activation so the panel's entrance animation replays. */}
                {active && <p.Panel key={`${p.id}-${index}`} />}
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/10 bg-night-950/60 px-5 py-4" aria-live={rotating ? "off" : "polite"}>
          <p className="font-display text-lg font-bold text-white">{PANELS[index].caption}</p>
          <p className="mt-0.5 text-sm text-brand-100/80">{PANELS[index].sub}</p>
          <div className="mt-3 flex items-center gap-2">
            <div role="tablist" aria-label="Choose a showcase" className="flex flex-1 gap-2">
              {PANELS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-controls={`showcase-${p.id}`}
                  onClick={() => setIndex(i)}
                  className="group flex-1 text-left"
                >
                  <span className="block h-1 overflow-hidden rounded-full bg-white/15">
                    <span
                      className={`block h-full rounded-full bg-sun-400 ${i === index ? "w-full" : i < index ? "w-full opacity-40" : "w-0"}`}
                      style={i === index && rotating ? { animation: `grow ${INTERVAL_MS}ms linear both` } : undefined}
                    />
                  </span>
                  <span className={`mt-1.5 block truncate text-[11px] font-semibold ${i === index ? "text-white" : "text-brand-200/70 group-hover:text-white"}`}>{p.tab}</span>
                </button>
              ))}
            </div>
            {!reduced && (
              <button
                type="button"
                onClick={() => setPaused((v) => !v)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                aria-label={paused ? "Play showcase animation" : "Pause showcase animation"}
              >
                <Icon name={paused ? "play" : "pause"} className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
