"use client";

import Link from "next/link";
import { useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { useInView, useReducedMotion } from "../motion";
import { AdderLab } from "./adder-lab";
import { CLab } from "./c-lab";
import { DatabaseLab } from "./database-lab";
import { HtmlLab } from "./html-lab";
import { LogicLab } from "./logic-lab";
import type { LabProps } from "./shared";

type Topic = { id: string; glyph: string; title: string; chapter: string; chapterBn: string; learn: string[]; Lab: ComponentType<LabProps> };

const TOPICS: Topic[] = [
  {
    id: "boolean",
    glyph: "A·B",
    title: "Boolean algebra & logic gates",
    chapter: "Chapter 3",
    chapterBn: "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস",
    learn: ["AND, OR, NOT, NAND, NOR, XOR gates", "Truth tables", "De Morgan's theorems and simplification"],
    Lab: LogicLab,
  },
  {
    id: "adder",
    glyph: "Σ",
    title: "Half adder & full adder",
    chapter: "Chapter 3",
    chapterBn: "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস",
    learn: ["How computers add binary numbers", "Sum and carry logic", "Building a full adder from half adders"],
    Lab: AdderLab,
  },
  {
    id: "html",
    glyph: "</>",
    title: "Web design with HTML",
    chapter: "Chapter 4",
    chapterBn: "ওয়েব ডিজাইন পরিচিতি এবং HTML",
    learn: ["Tags, elements and attributes", "Headings, lists, links and tables", "Building your own web page"],
    Lab: HtmlLab,
  },
  {
    id: "c",
    glyph: "{ }",
    title: "C programming",
    chapter: "Chapter 5",
    chapterBn: "প্রোগ্রামিং ভাষা",
    learn: ["Variables, data types and operators", "Conditions and loops", "Tracing a program line by line"],
    Lab: CLab,
  },
  {
    id: "database",
    glyph: "SQL",
    title: "Database & SQL",
    chapter: "Chapter 6",
    chapterBn: "ডেটাবেজ ম্যানেজমেন্ট সিস্টেম",
    learn: ["Tables, fields, records and primary keys", "SELECT, WHERE and ORDER BY", "Searching, sorting and COUNT"],
    Lab: DatabaseLab,
  },
];

/**
 * Interactive previews of the HSC ICT syllabus. Each topic animates by itself
 * while on screen; touching an input or step button hands control to the
 * visitor. Reduced-motion visitors get finished, still states.
 */
export function IctLab() {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const still = reduced || paused;
  const topic = TOPICS[active];

  const select = (i: number) => {
    setActive(i);
    setPaused(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + TOPICS.length) % TOPICS.length;
    select(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr] lg:items-start">
      <div role="tablist" aria-label="HSC ICT topics" aria-orientation="vertical" onKeyDown={onKeyDown} className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:flex-col lg:overflow-visible lg:px-0">
        {TOPICS.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`ict-tab-${t.id}`}
              aria-selected={on}
              aria-controls="ict-lab-stage"
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className={`group flex shrink-0 snap-start items-center gap-3 rounded-2xl border p-2.5 pr-4 text-left transition duration-300 lg:pr-3 ${on ? "border-brand-600 bg-brand-600 text-white shadow-lift" : "border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50"}`}
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold transition ${on ? "bg-sun-500 text-ink" : "bg-brand-50 text-brand-700 group-hover:bg-white"}`}>{t.glyph}</span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-bold whitespace-nowrap lg:whitespace-normal">{t.title}</span>
                <span className={`mt-0.5 block text-[11px] ${on ? "text-brand-100" : "text-muted"}`}>{t.chapter}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div ref={stage} id="ict-lab-stage" role="tabpanel" aria-labelledby={`ict-tab-${topic.id}`} className="relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-night-800 via-brand-900 to-night-900 text-white shadow-2xl">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sun-400">
              {topic.chapter} · <span className="font-sans">{topic.chapterBn}</span>
            </p>
            <h3 className="mt-1 text-lg font-extrabold sm:text-xl">{topic.title}</h3>
          </div>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
              aria-label={paused ? "Play animation" : "Pause animation"}
            >
              <Icon name={paused ? "play" : "pause"} className="size-3.5" />
            </button>
          )}
        </div>
        <div className="relative p-4 sm:p-6">
          <topic.Lab key={topic.id} playing={!still && inView} still={still} onInteract={() => setPaused(true)} />
        </div>
        <div className="relative flex flex-col gap-4 border-t border-white/10 bg-night-950/50 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-col gap-1.5 text-sm text-brand-100 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {topic.learn.map((l) => (
              <li key={l} className="flex items-center gap-2">
                <Icon name="check" className="size-4 shrink-0 text-leaf-400" /> {l}
              </li>
            ))}
          </ul>
          <Link href="/courses?category=hsc-ict" className="btn-sun shrink-0 px-5 py-3">
            Learn this in HSC ICT <Icon name="right" />
          </Link>
        </div>
      </div>
    </div>
  );
}
