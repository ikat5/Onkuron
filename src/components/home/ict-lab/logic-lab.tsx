"use client";

import { useState } from "react";
import { useInterval } from "../motion";
import { BitSwitch, Lamp, type LabProps } from "./shared";

type Gate = { name: string; expr: string; shape: "and" | "or" | "xor"; invert?: boolean; fn: (a: boolean, b: boolean) => boolean };

const GATES: Gate[] = [
  { name: "AND", expr: "A · B", shape: "and", fn: (a, b) => a && b },
  { name: "OR", expr: "A + B", shape: "or", fn: (a, b) => a || b },
  { name: "XOR", expr: "A ⊕ B", shape: "xor", fn: (a, b) => a !== b },
  { name: "NAND", expr: "(A · B)'", shape: "and", invert: true, fn: (a, b) => !(a && b) },
  { name: "NOR", expr: "(A + B)'", shape: "or", invert: true, fn: (a, b) => !(a || b) },
  { name: "XNOR", expr: "(A ⊕ B)'", shape: "xor", invert: true, fn: (a, b) => a === b },
];

/** Each law is proved live: both sides are evaluated with the current A and B. */
const LAWS: Array<{ name: string; lhs: string; rhs: string; l: (a: boolean, b: boolean) => boolean; r: (a: boolean, b: boolean) => boolean }> = [
  { name: "De Morgan's theorem", lhs: "(A + B)'", rhs: "A' · B'", l: (a, b) => !(a || b), r: (a, b) => !a && !b },
  { name: "De Morgan's theorem", lhs: "(A · B)'", rhs: "A' + B'", l: (a, b) => !(a && b), r: (a, b) => !a || !b },
  { name: "Absorption law", lhs: "A + A · B", rhs: "A", l: (a, b) => a || (a && b), r: (a) => a },
  { name: "Distributive law", lhs: "A · (A + B)", rhs: "A", l: (a, b) => a && (a || b), r: (a) => a },
  { name: "Complement law", lhs: "A + A'", rhs: "1", l: (a) => a || !a, r: () => true },
];

const COMBOS: Array<[boolean, boolean]> = [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
];

const wire = (on: boolean) => `transition-colors duration-300 ${on ? "stroke-sun-400" : "stroke-white/25"}`;

function GateSymbol({ gate, a, b }: { gate: Gate; a: boolean; b: boolean }) {
  const out = gate.fn(a, b);
  const end = gate.shape === "and" ? 54 : 56;
  return (
    <svg viewBox="0 0 90 40" className="h-10 w-full" aria-hidden>
      <path d="M0 12 H22" className={wire(a)} strokeWidth="2.5" />
      <path d="M0 28 H22" className={wire(b)} strokeWidth="2.5" />
      <path d={`M${end + (gate.invert ? 6 : 0)} 20 H90`} className={wire(out)} strokeWidth="2.5" />
      {gate.shape === "xor" && <path d="M13 4 Q23 20 13 36" fill="none" className={wire(out)} strokeWidth="2" />}
      <path
        d={gate.shape === "and" ? "M20 4 H38 A16 16 0 0 1 38 36 H20 Z" : "M18 4 Q28 20 18 36 Q42 36 56 20 Q42 4 18 4 Z"}
        className={`fill-night-800 ${wire(out)}`}
        strokeWidth="2"
      />
      {gate.invert && <circle cx={end + 3} cy="20" r="3" className={`fill-night-800 ${wire(out)}`} strokeWidth="2" />}
    </svg>
  );
}

export function LogicLab({ playing, onInteract }: LabProps) {
  const [combo, setCombo] = useState(3);
  const [law, setLaw] = useState(0);
  const [a, b] = COMBOS[combo];

  useInterval(() => setCombo((c) => (c + 1) % COMBOS.length), 1800, playing);
  useInterval(() => setLaw((l) => (l + 1) % LAWS.length), 3600, playing);

  const toggle = (which: "a" | "b") => {
    onInteract();
    setCombo((c) => c ^ (which === "a" ? 2 : 1));
  };
  const current = LAWS[law];
  const lv = current.l(a, b);
  const rv = current.r(a, b);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <BitSwitch label="A" on={a} onToggle={() => toggle("a")} />
          <BitSwitch label="B" on={b} onToggle={() => toggle("b")} />
          <p className="text-xs text-brand-100/70">Tap A or B and watch every gate react.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {GATES.map((g) => {
            const out = g.fn(a, b);
            return (
              <li key={g.name} className={`rounded-xl border p-2.5 transition-colors duration-300 ${out ? "border-sun-400/50 bg-sun-500/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-white">{g.name}</span>
                  <Lamp on={out} />
                </div>
                <GateSymbol gate={g} a={a} b={b} />
                <p className="flex items-center justify-between font-mono text-[11px] text-brand-100/80">
                  <span>Y = {g.expr}</span>
                  <span className={out ? "font-bold text-sun-400" : "text-brand-200/60"}>{+out}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-night-950/60 p-4">
        <p className="eyebrow text-leaf-400">Boolean law, proved live</p>
        <div key={law} className="animate-fade-up">
          <p className="text-xs font-semibold text-brand-200">{current.name}</p>
          <p className="mt-2 font-mono text-lg font-bold text-white">
            {current.lhs} <span className="text-sun-400">=</span> {current.rhs}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <span className="rounded-lg bg-white/5 px-2 py-1.5 text-brand-100">
            LHS = <b className="text-white">{+lv}</b>
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1.5 text-brand-100">
            RHS = <b className="text-white">{+rv}</b>
          </span>
        </div>
        <p className="text-xs text-brand-100/70">
          With A = {+a}, B = {+b} both sides match{" "}
          <span className="font-bold text-leaf-400">{lv === rv ? "✓" : "✗"}</span> — try every input, they always will.
        </p>
        <div className="mt-auto flex gap-1.5" aria-hidden>
          {LAWS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i === law ? "bg-sun-400" : "bg-white/15"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
