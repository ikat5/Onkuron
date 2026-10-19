"use client";

import { useEffect, useState } from "react";
import type { LabProps } from "./shared";

type Row = { roll: number; name: string; dept: string; marks: number };

const STUDENTS: Row[] = [
  { roll: 101, name: "Rahim", dept: "Science", marks: 88 },
  { roll: 102, name: "Karim", dept: "Commerce", marks: 72 },
  { roll: 103, name: "Nusrat", dept: "Science", marks: 95 },
  { roll: 104, name: "Tania", dept: "Arts", marks: 64 },
  { roll: 105, name: "Arif", dept: "Science", marks: 79 },
];

type Query = {
  label: string;
  /** [class, text] tokens, so the typing effect keeps syntax colours. */
  sql: Array<[string, string]>;
  match: (r: Row) => boolean;
  columns: string[];
  result: () => Array<Array<string | number>>;
  note: string;
};

const K = "text-sun-400";
const T = "text-white";
const S = "text-leaf-400";
const N = "text-brand-300";

const QUERIES: Query[] = [
  {
    label: "WHERE",
    sql: [[K, "SELECT "], [T, "name, marks "], [K, "FROM "], [T, "Students "], [K, "WHERE "], [T, "marks >= "], [N, "80"], [T, ";"]],
    match: (r) => r.marks >= 80,
    columns: ["name", "marks"],
    result: () => STUDENTS.filter((r) => r.marks >= 80).map((r) => [r.name, r.marks]),
    note: "WHERE keeps only the rows that satisfy the condition.",
  },
  {
    label: "Text filter",
    sql: [[K, "SELECT "], [T, "roll, name "], [K, "FROM "], [T, "Students "], [K, "WHERE "], [T, "dept = "], [S, "'Science'"], [T, ";"]],
    match: (r) => r.dept === "Science",
    columns: ["roll", "name"],
    result: () => STUDENTS.filter((r) => r.dept === "Science").map((r) => [r.roll, r.name]),
    note: "Text values go inside single quotes.",
  },
  {
    label: "ORDER BY",
    sql: [[K, "SELECT "], [T, "name, marks "], [K, "FROM "], [T, "Students "], [K, "ORDER BY "], [T, "marks "], [K, "DESC"], [T, ";"]],
    match: () => true,
    columns: ["name", "marks"],
    result: () => [...STUDENTS].sort((x, y) => y.marks - x.marks).map((r) => [r.name, r.marks]),
    note: "ORDER BY … DESC sorts from highest to lowest.",
  },
  {
    label: "COUNT",
    sql: [[K, "SELECT COUNT"], [T, "(*) "], [K, "FROM "], [T, "Students "], [K, "WHERE "], [T, "marks >= "], [N, "70"], [T, ";"]],
    match: (r) => r.marks >= 70,
    columns: ["COUNT(*)"],
    result: () => [[STUDENTS.filter((r) => r.marks >= 70).length]],
    note: "Aggregate functions summarise many rows into one value.",
  },
];

const sqlLength = (q: Query) => q.sql.reduce((n, [, t]) => n + t.length, 0);

type Phase = "type" | "scan" | "result";
type State = { q: number; phase: Phase; n: number };

function TypedSql({ query, chars }: { query: Query; chars: number }) {
  const starts = query.sql.map((_, i) => query.sql.slice(0, i).reduce((n, [, t]) => n + t.length, 0));
  return (
    <>
      {query.sql.map(([cls, text], i) => {
        const shown = text.slice(0, Math.max(0, chars - starts[i]));
        return (
          <span key={i} className={cls}>
            {shown}
          </span>
        );
      })}
    </>
  );
}

export function DatabaseLab({ playing, still, onInteract }: LabProps) {
  const [state, setState] = useState<State>({ q: 0, phase: "type", n: 0 });
  // Without autoplay, show each query already run.
  const view: State = still && state.phase === "type" && state.n === 0 ? { ...state, phase: "result", n: STUDENTS.length } : state;
  const query = QUERIES[view.q];
  const total = sqlLength(query);

  useEffect(() => {
    if (!playing) return;
    const { q, phase, n } = state;
    const [delay, next]: [number, State] =
      phase === "type"
        ? n < total
          ? [38, { q, phase, n: n + 1 }]
          : [450, { q, phase: "scan", n: 0 }]
        : phase === "scan"
          ? n < STUDENTS.length
            ? [420, { q, phase, n: n + 1 }]
            : [250, { q, phase: "result", n }]
          : [3400, { q: (q + 1) % QUERIES.length, phase: "type", n: 0 }];
    const t = setTimeout(() => setState(next), delay);
    return () => clearTimeout(t);
  }, [playing, state, total]);

  const choose = (q: number) => {
    onInteract();
    setState({ q, phase: "result", n: STUDENTS.length });
  };

  const chars = view.phase === "type" ? view.n : total;
  const scanned = view.phase === "type" ? 0 : view.phase === "scan" ? view.n : STUDENTS.length;
  const rows = view.phase === "result" ? query.result() : [];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="SQL examples" className="flex flex-wrap gap-2">
        {QUERIES.map((q, i) => (
          <button
            key={q.label}
            type="button"
            role="tab"
            aria-selected={i === view.q}
            onClick={() => choose(i)}
            className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold transition-colors ${i === view.q ? "border-sun-400/60 bg-sun-500/15 text-white" : "border-white/15 text-brand-100 hover:bg-white/10"}`}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-night-950/80">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 font-mono text-[10px] text-brand-200">
          <span className="size-2 rounded-full bg-leaf-400" /> SQL query
        </div>
        <p className="min-h-[3.5rem] p-3 font-mono text-[13px] leading-6 break-words sm:text-sm" aria-label={query.sql.map(([, t]) => t).join("")}>
          <TypedSql query={query} chars={chars} />
          {view.phase === "type" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-caret bg-sun-400 align-middle" />}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <p className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-semibold text-brand-100">
            <span>
              Table: <span className="font-mono text-white">Students</span>
            </span>
            <span className="text-[10px] text-brand-200">🔑 roll = primary key</span>
          </p>
          <table className="w-full text-left font-mono text-[11px] sm:text-xs">
            <thead className="text-brand-200">
              <tr>
                {["roll", "name", "dept", "marks"].map((h) => (
                  <th key={h} className="px-2.5 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map((r, i) => {
                const done = i < scanned;
                const hit = done && query.match(r);
                const current = view.phase === "scan" && i === scanned;
                return (
                  <tr
                    key={r.roll}
                    className={`border-t border-white/5 transition-all duration-300 ${current ? "bg-brand-500/30 text-white" : hit ? "bg-leaf-500/20 text-white" : done ? "text-brand-100/35" : "text-brand-100"}`}
                  >
                    <td className="px-2.5 py-1.5">{r.roll}</td>
                    <td className="px-2.5">{r.name}</td>
                    <td className="px-2.5">{r.dept}</td>
                    <td className="px-2.5">
                      {r.marks}
                      {hit && <span className="ml-1 text-leaf-400">✓</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col rounded-2xl border border-white/10 bg-night-950/60 p-3">
          <p className="eyebrow text-leaf-400">Result</p>
          {rows.length > 0 ? (
            <div key={view.q} className="animate-fade-up">
              <table className="mt-2 w-full text-left font-mono text-xs text-white">
                <thead className="text-sun-400">
                  <tr>
                    {query.columns.map((c) => (
                      <th key={c} className="py-1 pr-2 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 pr-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-brand-100/70">
                {rows.length} row{rows.length === 1 ? "" : "s"} · {query.note}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-brand-100/60">{view.phase === "scan" ? "Checking each row…" : "Waiting for the query…"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
