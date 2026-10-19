"use client";

import { Icon } from "@/components/icons";

export interface LabProps {
  /** Autoplay is allowed: on screen, not paused, no reduced-motion preference. */
  playing: boolean;
  /** Autoplay is off for good (paused or reduced motion), not just scrolled away: show finished states. */
  still: boolean;
  /** The visitor took control (toggled an input, stepped manually): stop autoplay. */
  onInteract: () => void;
}

/** A 0/1 input the visitor can flip. */
export function BitSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Input ${label}`}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full border py-1 pr-1 pl-3 font-mono text-sm font-bold transition-colors ${on ? "border-sun-400/60 bg-sun-500/15 text-white" : "border-white/15 bg-white/5 text-brand-100"}`}
    >
      {label}
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${on ? "bg-sun-500" : "bg-white/15"}`}>
        <span className={`flex size-5 items-center justify-center rounded-full bg-white text-[10px] text-ink shadow transition-transform duration-300 ease-out-soft ${on ? "translate-x-5" : ""}`}>{+on}</span>
      </span>
    </button>
  );
}

/** Output indicator: glows when the signal is 1. */
export function Lamp({ on, label }: { on: boolean; label?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {label && <span className="font-mono text-xs font-bold text-brand-100">{label}</span>}
      <span
        aria-label={label ? `${label} = ${+on}` : undefined}
        className={`size-3.5 rounded-full border transition-all duration-300 ${on ? "border-sun-400 bg-sun-400 shadow-[0_0_12px_2px] shadow-sun-400/70" : "border-white/25 bg-night-950"}`}
      />
    </span>
  );
}

/** Previous / next buttons for step-through visualisations. */
export function StepControls({ step, total, onStep, label }: { step: number; total: number; onStep: (next: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} aria-label={`Previous ${label}`} className="flex size-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 disabled:opacity-30">
        <Icon name="left" className="size-3.5" />
      </button>
      <span className="min-w-14 text-center font-mono text-xs text-brand-100">
        {step + 1} / {total}
      </span>
      <button type="button" onClick={() => onStep(Math.min(total - 1, step + 1))} disabled={step === total - 1} aria-label={`Next ${label}`} className="flex size-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 disabled:opacity-30">
        <Icon name="right" className="size-3.5" />
      </button>
    </div>
  );
}
