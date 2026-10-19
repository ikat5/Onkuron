"use client";

import { useEffect, useState, type ReactNode } from "react";
import { StepControls, type LabProps } from "./shared";

type Block = { tag: string; explain: string; code: string[]; render: ReactNode };

const BLOCKS: Block[] = [
  {
    tag: "<h1>",
    explain: "<h1> is the largest heading. There are six levels, <h1> to <h6>.",
    code: ["<h1>My School</h1>"],
    render: <h1 className="font-serif text-xl leading-tight font-bold tracking-normal">My School</h1>,
  },
  {
    tag: "<p> <b>",
    explain: "<p> makes a paragraph; <b> makes text bold inside it.",
    code: ["<p>Welcome to <b>HSC ICT</b>!</p>"],
    render: (
      <p className="text-sm">
        Welcome to <b>HSC ICT</b>!
      </p>
    ),
  },
  {
    tag: "<ul> <li>",
    explain: "<ul> is an unordered (bulleted) list; each <li> is one item.",
    code: ["<ul>", "  <li>Database</li>", "  <li>C Programming</li>", "</ul>"],
    render: (
      <ul className="list-disc pl-5 text-sm">
        <li>Database</li>
        <li>C Programming</li>
      </ul>
    ),
  },
  {
    tag: "<a href>",
    explain: "<a> creates a hyperlink; the href attribute says where it goes.",
    code: ['<a href="result.html">See result</a>'],
    render: <span className="text-sm text-blue-700 underline">See result</span>,
  },
  {
    tag: "<table>",
    explain: "<table> holds rows (<tr>) and cells (<td>); border draws the lines.",
    code: ['<table border="1">', "  <tr><td>ICT</td><td>A+</td></tr>", "</table>"],
    render: (
      <table className="border-collapse border border-ink text-sm">
        <tbody>
          <tr>
            <td className="border border-ink px-2">ICT</td>
            <td className="border border-ink px-2">A+</td>
          </tr>
        </tbody>
      </table>
    ),
  },
];

/** Colours tags, attribute names and attribute values in a line of HTML. */
function Highlight({ line }: { line: string }) {
  const parts = line.split(/(<[^>]+>)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith("<")) return <span key={i} className="text-white">{part}</span>;
        const m = /^(<\/?[\w!]+)(.*?)(>)$/.exec(part);
        if (!m) return <span key={i} className="text-brand-300">{part}</span>;
        const attrs = m[2].split(/(\s[\w-]+=)("[^"]*")/g).filter(Boolean);
        return (
          <span key={i}>
            <span className="text-brand-300">{m[1]}</span>
            {attrs.map((a, j) => (
              <span key={j} className={a.startsWith('"') ? "text-sun-400" : "text-leaf-400"}>
                {a}
              </span>
            ))}
            <span className="text-brand-300">{m[3]}</span>
          </span>
        );
      })}
    </>
  );
}

export function HtmlLab({ playing, still, onInteract }: LabProps) {
  // step = number of blocks added to <body>
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  // Without autoplay, start from the finished page.
  const shown = still && !touched ? BLOCKS.length : step;

  useEffect(() => {
    if (!playing) return;
    const last = step === BLOCKS.length;
    const t = setTimeout(() => setStep(last ? 0 : step + 1), last ? 3200 : step === 0 ? 1400 : 2300);
    return () => clearTimeout(t);
  }, [playing, step]);

  const lines: Array<{ text: string; fresh: boolean }> = [
    { text: "<!DOCTYPE html>", fresh: false },
    { text: "<html>", fresh: false },
    { text: "<body>", fresh: false },
    ...BLOCKS.slice(0, shown).flatMap((b, i) => b.code.map((text) => ({ text: `  ${text}`, fresh: i === shown - 1 }))),
    { text: "</body>", fresh: false },
    { text: "</html>", fresh: false },
  ];
  const current = shown > 0 ? BLOCKS[shown - 1] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-950/90">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-sun-400/80" />
            <span className="size-2.5 rounded-full bg-leaf-400/80" />
            <span className="ml-2 font-mono text-[10px] text-brand-200">index.html</span>
          </div>
          <pre className="min-h-[17rem] overflow-x-auto p-3 font-mono text-[11px] leading-6 sm:text-xs">
            {lines.map((l, i) => (
              <div key={`${i}-${l.text}`} className={`${l.fresh ? "animate-fade-up -mx-3 border-l-2 border-sun-400 bg-sun-500/10 px-3" : ""} whitespace-pre`}>
                <Highlight line={l.text} />
              </div>
            ))}
          </pre>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white">
          <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2">
            <span className="h-4 flex-1 rounded-full bg-white px-2 font-mono text-[10px] leading-4 text-muted ring-1 ring-line">file:///index.html</span>
          </div>
          <div className="flex min-h-[14rem] flex-1 flex-col gap-2.5 p-4 font-serif text-ink">
            {shown === 0 && <p className="m-auto font-sans text-xs text-muted">An empty page — add some tags!</p>}
            {BLOCKS.slice(0, shown).map((b, i) => (
              <div key={b.tag} className={i === shown - 1 ? "animate-fade-up rounded outline-2 outline-offset-2 outline-sun-400 outline-dashed" : ""}>
                {b.render}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p key={shown} className="animate-fade-up text-sm text-brand-100" aria-live={playing ? "off" : "polite"}>
          {current ? (
            <>
              <span className="mr-2 rounded-md bg-sun-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-sun-400">{current.tag}</span>
              {current.explain}
            </>
          ) : (
            "Every page starts with <html> and puts what you see inside <body>."
          )}
        </p>
        <StepControls
          step={shown}
          total={BLOCKS.length + 1}
          label="tag"
          onStep={(next) => {
            onInteract();
            setTouched(true);
            setStep(next);
          }}
        />
      </div>
    </div>
  );
}
