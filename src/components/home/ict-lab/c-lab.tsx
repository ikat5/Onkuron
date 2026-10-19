"use client";

import { useEffect, useState } from "react";
import { StepControls, type LabProps } from "./shared";

const P = "text-leaf-400"; // preprocessor
const K = "text-sun-400"; // keyword
const T = "text-white";
const N = "text-brand-300"; // number
const S = "text-leaf-400"; // string

const CODE: Array<Array<[string, string]>> = [
  [[P, "#include "], [S, "<stdio.h>"]],
  [],
  [[K, "int "], [T, "main() {"]],
  [[K, "    int "], [T, "i, sum = "], [N, "0"], [T, ";"]],
  [[K, "    for "], [T, "(i = "], [N, "1"], [T, "; i <= "], [N, "5"], [T, "; i++) {"]],
  [[T, "        sum = sum + i;"]],
  [[T, "    }"]],
  [[K, "    printf"], [T, "("], [S, '"Sum = %d\\n"'], [T, ", sum);"]],
  [[K, "    return "], [N, "0"], [T, ";"]],
  [[T, "}"]],
];

type Step = { line: number; i?: number; sum?: number; note: string; changed?: "i" | "sum"; out?: boolean };

const STEPS: Step[] = (() => {
  const steps: Step[] = [
    { line: 2, note: "Every C program starts running at main()." },
    { line: 3, sum: 0, note: "Two int variables are created; sum starts at 0.", changed: "sum" },
  ];
  let sum = 0;
  for (let i = 1; i <= 5; i++) {
    steps.push({ line: 4, i, sum, note: `${i === 1 ? "i = 1" : `i++ makes i = ${i}`}; is ${i} <= 5? Yes → enter the loop.`, changed: "i" });
    steps.push({ line: 5, i, sum: sum + i, note: `sum = ${sum} + ${i} = ${sum + i}`, changed: "sum" });
    sum += i;
  }
  steps.push({ line: 4, i: 6, sum, note: "i++ makes i = 6; is 6 <= 5? No → the loop ends.", changed: "i" });
  steps.push({ line: 7, i: 6, sum, note: "printf() prints the value of sum to the screen.", out: true });
  steps.push({ line: 8, i: 6, sum, note: "return 0 tells the system the program finished successfully.", out: true });
  return steps;
})();

function Variable({ name, value, flash }: { name: string; value?: number; flash: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 transition-colors duration-300 ${flash ? "border-sun-400/60 bg-sun-500/15" : "border-white/10 bg-white/5"}`}>
      <p className="font-mono text-[10px] text-brand-200">
        <span className="text-sun-400">int</span> {name}
      </p>
      <p key={`${name}-${value}`} className="animate-fade-up font-mono text-xl font-bold text-white">
        {value ?? "?"}
      </p>
    </div>
  );
}

export function CLab({ playing, onInteract }: LabProps) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  useEffect(() => {
    if (!playing) return;
    const last = step === STEPS.length - 1;
    const t = setTimeout(() => setStep(last ? 0 : step + 1), last ? 2800 : 1150);
    return () => clearTimeout(t);
  }, [playing, step]);

  return (
    <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-950/90">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-sun-400/80" />
          <span className="size-2.5 rounded-full bg-leaf-400/80" />
          <span className="ml-2 font-mono text-[10px] text-brand-200">sum.c</span>
        </div>
        <pre className="overflow-x-auto py-2 font-mono text-[11px] leading-6 sm:text-xs">
          {CODE.map((line, n) => {
            const active = n === s.line;
            return (
              <div key={n} className={`flex border-l-2 pr-3 transition-colors duration-300 ${active ? "border-sun-400 bg-brand-500/25" : "border-transparent"}`}>
                <span className={`w-8 shrink-0 pr-2 text-right select-none ${active ? "text-sun-400" : "text-brand-200/40"}`}>{active ? "▶" : n + 1}</span>
                <span className="whitespace-pre">
                  {line.map(([cls, text], j) => (
                    <span key={j} className={cls}>
                      {text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </pre>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Variable name="i" value={s.i} flash={s.changed === "i"} />
          <Variable name="sum" value={s.sum} flash={s.changed === "sum"} />
        </div>
        <p key={step} className="animate-fade-up min-h-[3.75rem] rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-brand-100" aria-live={playing ? "off" : "polite"}>
          {s.note}
        </p>
        <div className="flex-1 rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-xs">
          <p className="text-brand-200/60">$ gcc sum.c &amp;&amp; ./a.out</p>
          {s.out && <p className="animate-fade-up mt-1 text-leaf-400">Sum = 15</p>}
          {step === STEPS.length - 1 && <p className="mt-1 text-brand-200/60">Process exited with code 0</p>}
        </div>
        <StepControls
          step={step}
          total={STEPS.length}
          label="step"
          onStep={(next) => {
            onInteract();
            setStep(next);
          }}
        />
      </div>
    </div>
  );
}
