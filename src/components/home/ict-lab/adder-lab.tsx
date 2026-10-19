"use client";

import { useState } from "react";
import { useInterval } from "../motion";
import { BitSwitch, Lamp, type LabProps } from "./shared";

const AND = "M0 0 H20 A20 20 0 0 1 20 40 H0 Z";
const OR = "M0 0 Q12 20 0 40 Q30 40 45 20 Q30 0 0 0 Z";
const XOR_BACK = "M-6 0 Q6 20 -6 40";

const tone = (on: boolean) => `transition-colors duration-300 ${on ? "stroke-sun-400" : "stroke-white/25"}`;

function Wire({ d, on }: { d: string; on: boolean }) {
  return <path d={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" className={tone(on)} />;
}

function Gate({ x, y, kind, on }: { x: number; y: number; kind: "and" | "or" | "xor"; on: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {kind === "xor" && <path d={XOR_BACK} fill="none" strokeWidth="2" className={tone(on)} />}
      <path d={kind === "and" ? AND : OR} strokeWidth="2" className={`fill-night-800 ${tone(on)}`} />
      <text x={kind === "and" ? 17 : 20} y="24" textAnchor="middle" className="fill-brand-100 font-mono text-[10px] font-bold">
        {kind.toUpperCase()}
      </text>
    </g>
  );
}

function Dot({ x, y, on }: { x: number; y: number; on: boolean }) {
  return <circle cx={x} cy={y} r="3" className={`transition-colors duration-300 ${on ? "fill-sun-400" : "fill-white/40"}`} />;
}

/** Gate-level full adder: two half adders plus an OR gate for the carry. */
function Circuit({ a, b, c }: { a: boolean; b: boolean; c: boolean }) {
  const x1 = a !== b;
  const s = x1 !== c;
  const c1 = a && b;
  const c2 = x1 && c;
  const cout = c1 || c2;
  const label = "fill-brand-100 font-mono text-[14px] font-bold";
  return (
    <svg viewBox="0 0 400 205" className="w-full" role="img" aria-label={`Full adder circuit: A=${+a}, B=${+b}, Cin=${+c} gives Sum=${+s}, Carry=${+cout}`}>
      <rect x="78" y="16" width="64" height="184" rx="8" fill="none" strokeDasharray="4 4" className="stroke-leaf-400/50" />
      <text x="110" y="11" textAnchor="middle" className="fill-leaf-400 text-[10px] font-semibold">Half adder 1</text>
      <rect x="198" y="30" width="68" height="120" rx="8" fill="none" strokeDasharray="4 4" className="stroke-leaf-400/50" />
      <text x="232" y="25" textAnchor="middle" className="fill-leaf-400 text-[10px] font-semibold">Half adder 2</text>

      <Wire d="M30 35 H94" on={a} />
      <Wire d="M50 35 V160 H90" on={a} />
      <Wire d="M30 55 H94" on={b} />
      <Wire d="M65 55 V180 H90" on={b} />
      <Wire d="M30 120 H185 V70 H214" on={c} />
      <Wire d="M185 120 V130 H210" on={c} />
      <Wire d="M135 45 H170 V50 H214" on={x1} />
      <Wire d="M170 50 V110 H210" on={x1} />
      <Wire d="M255 60 H372" on={s} />
      <Wire d="M250 120 H275 V135 H304" on={c2} />
      <Wire d="M130 170 H285 V155 H304" on={c1} />
      <Wire d="M345 145 H372" on={cout} />

      <Dot x={50} y={35} on={a} />
      <Dot x={65} y={55} on={b} />
      <Dot x={170} y={50} on={x1} />
      <Dot x={185} y={120} on={c} />

      <Gate x={90} y={25} kind="xor" on={x1} />
      <Gate x={90} y={150} kind="and" on={c1} />
      <Gate x={210} y={40} kind="xor" on={s} />
      <Gate x={210} y={100} kind="and" on={c2} />
      <Gate x={300} y={125} kind="or" on={cout} />

      <text x="4" y="39" className={label}>A</text>
      <text x="4" y="59" className={label}>B</text>
      <text x="0" y="125" className={label}>Cin</text>
      <text x="376" y="64" className={label}>S</text>
      <text x="350" y="138" className="fill-brand-100 font-mono text-[11px] font-bold">Cout</text>
      <circle cx="388" cy="145" r="6" className={`transition-colors duration-300 ${cout ? "fill-sun-400" : "fill-night-950 stroke-white/30"}`} />
      <circle cx="394" cy="60" r="6" className={`transition-colors duration-300 ${s ? "fill-sun-400" : "fill-night-950 stroke-white/30"}`} />
    </svg>
  );
}

const bits = (n: number) => [Boolean(n & 4), Boolean(n & 2), Boolean(n & 1)] as const;

export function AdderLab({ playing, onInteract }: LabProps) {
  const [n, setN] = useState(7);
  const [a, b, c] = bits(n);
  const sum = +a + +b + +c;

  useInterval(() => setN((v) => (v + 1) % 8), 2000, playing);

  const flip = (mask: number) => {
    onInteract();
    setN((v) => v ^ mask);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_13rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <BitSwitch label="A" on={a} onToggle={() => flip(4)} />
          <BitSwitch label="B" on={b} onToggle={() => flip(2)} />
          <BitSwitch label="Cin" on={c} onToggle={() => flip(1)} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-night-950/60 p-2 sm:p-4">
          <Circuit a={a} b={b} c={c} />
        </div>
        <div className="grid gap-2 font-mono text-xs text-brand-100 sm:grid-cols-2">
          <p className="rounded-lg bg-white/5 px-3 py-2">
            S = A ⊕ B ⊕ Cin = <b className="text-sun-400">{sum & 1}</b>
          </p>
          <p className="rounded-lg bg-white/5 px-3 py-2">
            Cout = AB + Cin(A ⊕ B) = <b className="text-sun-400">{sum >> 1}</b>
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-night-950/60 p-3">
        <p className="eyebrow mb-2 text-leaf-400">Truth table</p>
        <table className="w-full text-center font-mono text-xs">
          <thead className="text-brand-200">
            <tr>
              <th className="py-1 font-semibold">A</th>
              <th className="font-semibold">B</th>
              <th className="font-semibold">Cin</th>
              <th className="font-semibold text-sun-400">Cout</th>
              <th className="font-semibold text-sun-400">S</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, row) => {
              const [ra, rb, rc] = bits(row);
              const rs = +ra + +rb + +rc;
              return (
                <tr key={row} className={`transition-colors duration-300 ${row === n ? "bg-sun-500/20 text-white" : "text-brand-100/70"}`}>
                  <td className="rounded-l-md py-0.5">{+ra}</td>
                  <td>{+rb}</td>
                  <td>{+rc}</td>
                  <td className="font-bold">{rs >> 1}</td>
                  <td className="rounded-r-md font-bold">{rs & 1}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="font-mono text-xs text-brand-100">
            {+a} + {+b} + {+c} = <b className="text-white">{(sum >> 1).toString()}{(sum & 1).toString()}</b>
            <sub>2</sub>
          </span>
          <span className="flex gap-2">
            <Lamp on={Boolean(sum >> 1)} label="C" />
            <Lamp on={Boolean(sum & 1)} label="S" />
          </span>
        </div>
      </div>
    </div>
  );
}
