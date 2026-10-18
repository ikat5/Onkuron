"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true, // server render: no motion until we know
  );
}

const C = {
  blue: "#7eaae3",
  blueStrong: "#2a6bc0",
  green: "#4cb262",
  orange: "#f5a066",
  text: "#dbe7fd",
  dim: "#5d7396",
  panel: "#16233f",
  line: "#2b3d63",
};

/** SVG motion is SMIL; it is only rendered when the viewer allows motion. */
type SceneProps = { step: number; motion: boolean };

function Label({ x, y, children, anchor = "middle", size = 9, fill = C.text, weight = 600 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number; fill?: string; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} fontWeight={weight} fontFamily="ui-sans-serif, system-ui, sans-serif">
      {children}
    </text>
  );
}

function Flow({ x1, y1, x2, y2, color = C.blue, motion, active = true }: { x1: number; y1: number; x2: number; y2: number; color?: string; motion: boolean; active?: boolean }) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? color : C.line} strokeWidth={1.5} strokeDasharray="4 5" strokeLinecap="round" opacity={active ? 0.9 : 0.6}>
      {motion && active && <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.9s" repeatCount="indefinite" />}
    </line>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 1: how a CPU runs a program                                    */
/* ------------------------------------------------------------------ */

const PROGRAM = ["LOAD  A, 5", "LOAD  B, 3", "ADD   A, B", "STORE A → x"];
const REGISTERS = [
  { a: "5", b: "–", out: "" },
  { a: "5", b: "3", out: "" },
  { a: "8", b: "3", out: "5 + 3" },
  { a: "8", b: "3", out: "" },
];

function CpuScene({ step, motion }: SceneProps) {
  const r = REGISTERS[step];
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label="A CPU fetching instructions from memory, adding two numbers and storing the result">
      {/* Memory */}
      <rect x="18" y="28" width="132" height="170" rx="10" fill={C.panel} stroke={C.line} />
      <Label x={84} y={46} size={10} fill={C.blue}>
        MEMORY (RAM)
      </Label>
      {PROGRAM.map((ins, i) => (
        <g key={ins}>
          <rect x="30" y={58 + i * 30} width="108" height="22" rx="5" fill={i === step ? C.blueStrong : "#1d2c4d"} stroke={i === step ? C.blue : "transparent"} />
          <Label x={38} y={73 + i * 30} anchor="start" size={9} fill={i === step ? "#fff" : C.dim} weight={700}>
            {`${i}  ${ins}`}
          </Label>
        </g>
      ))}
      <Label x={84} y={190} size={8} fill={step === 3 ? C.green : C.dim}>
        {step === 3 ? "x = 8 ✓" : "x = ?"}
      </Label>

      {/* Bus */}
      <Flow x1={150} y1={69 + step * 30} x2={222} y2={110} motion={motion} color={step === 3 ? C.green : C.blue} />
      {motion && (
        <circle r="4" fill={step === 3 ? C.green : C.orange}>
          <animateMotion dur="1.2s" repeatCount="indefinite" path={step === 3 ? `M222 110 L150 ${69 + step * 30}` : `M150 ${69 + step * 30} L222 110`} />
        </circle>
      )}

      {/* CPU */}
      <rect x="222" y="40" width="160" height="150" rx="12" fill="#13203a" stroke={C.blue} strokeWidth={1.5} />
      {[60, 90, 120, 150, 175].map((y) => (
        <g key={y}>
          <line x1="214" y1={y} x2="222" y2={y} stroke={C.blue} />
          <line x1="382" y1={y} x2="390" y2={y} stroke={C.blue} />
        </g>
      ))}
      <Label x={302} y={58} size={10} fill={C.blue}>
        CPU
      </Label>
      <rect x="236" y="68" width="132" height="24" rx="5" fill="#1d2c4d" />
      <Label x={302} y={84} size={9}>
        {["Fetch", "Fetch", "Decode → Execute", "Store"][step]}
      </Label>
      {(["A", "B"] as const).map((reg, i) => (
        <g key={reg}>
          <rect x={236 + i * 70} y="102" width="62" height="34" rx="6" fill="#1d2c4d" stroke={(step === 0 && reg === "A") || (step === 1 && reg === "B") || (step === 2 && reg === "A") ? C.orange : C.line} />
          <Label x={248 + i * 70} y={116} anchor="start" size={8} fill={C.dim}>
            Reg {reg}
          </Label>
          <Label x={286 + i * 70} y={130} anchor="end" size={13} fill="#fff" weight={800}>
            {reg === "A" ? r.a : r.b}
          </Label>
        </g>
      ))}
      <rect x="236" y="146" width="132" height="30" rx="6" fill={step === 2 ? "#3a2a12" : "#1d2c4d"} stroke={step === 2 ? C.orange : C.line} />
      <Label x={250} y={165} anchor="start" size={9} fill={step === 2 ? C.orange : C.dim}>
        ALU
      </Label>
      <Label x={356} y={165} anchor="end" size={10} fill="#fff" weight={700}>
        {r.out}
      </Label>
      {motion && step === 2 && <rect x="236" y="146" width="132" height="30" rx="6" fill={C.orange} opacity="0">
        <animate attributeName="opacity" values="0;0.25;0" dur="0.8s" repeatCount="indefinite" />
      </rect>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 2: how AI recognises a handwritten digit                       */
/* ------------------------------------------------------------------ */

const SEVEN = ["11111", "00010", "00100", "00100", "01000"];
const LAYERS = [
  { x: 128, n: 4 },
  { x: 208, n: 5 },
  { x: 288, n: 4 },
];
const OUTPUTS = [
  { label: "1", p: 0.05 },
  { label: "4", p: 0.03 },
  { label: "7", p: 0.92 },
];
const nodeY = (n: number, i: number) => 112 + (i - (n - 1) / 2) * 34;

function AiScene({ step, motion }: SceneProps) {
  const layerActive = (l: number) => step >= l + 1;
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label="A neural network reads the pixels of a handwritten 7 and outputs 7 with 92% confidence">
      {/* Input image */}
      <Label x={52} y={36} size={9} fill={C.blue}>
        INPUT
      </Label>
      {SEVEN.map((row, y) =>
        row.split("").map((px, x) => (
          <rect key={`${x}${y}`} x={22 + x * 12} y={48 + y * 12} width="11" height="11" rx="2" fill={px === "1" ? "#fff" : "#1d2c4d"}>
            {motion && px === "1" && <animate attributeName="opacity" values="1;0.55;1" dur="2s" begin={`${(x + y) * 0.1}s`} repeatCount="indefinite" />}
          </rect>
        )),
      )}
      <Label x={52} y={128} size={8} fill={C.dim}>
        25 pixels → numbers
      </Label>

      {/* Connections */}
      {LAYERS.slice(0, -1).map((L, l) =>
        Array.from({ length: L.n }).flatMap((_, i) =>
          Array.from({ length: LAYERS[l + 1].n }).map((__, j) => (
            <Flow key={`${l}-${i}-${j}`} x1={L.x} y1={nodeY(L.n, i)} x2={LAYERS[l + 1].x} y2={nodeY(LAYERS[l + 1].n, j)} motion={motion} active={layerActive(l + 1)} color={(i + j) % 3 === 0 ? C.orange : C.blue} />
          )),
        ),
      )}
      {Array.from({ length: LAYERS[0].n }).map((_, i) => (
        <Flow key={`in-${i}`} x1={84} y1={78} x2={LAYERS[0].x} y2={nodeY(LAYERS[0].n, i)} motion={motion} active={layerActive(0)} />
      ))}
      {Array.from({ length: LAYERS[2].n }).map((_, i) => (
        <Flow key={`out-${i}`} x1={LAYERS[2].x} y1={nodeY(LAYERS[2].n, i)} x2={330} y2={112} motion={motion} active={step >= 3} color={C.green} />
      ))}

      {/* Neurons */}
      {LAYERS.map((L, l) =>
        Array.from({ length: L.n }).map((_, i) => (
          <circle key={`${l}${i}`} cx={L.x} cy={nodeY(L.n, i)} r="8" fill={layerActive(l) ? C.blueStrong : "#1d2c4d"} stroke={layerActive(l) ? C.blue : C.line} strokeWidth={1.5}>
            {motion && layerActive(l) && <animate attributeName="r" values="7;9;7" dur="1.4s" begin={`${l * 0.3 + i * 0.12}s`} repeatCount="indefinite" />}
          </circle>
        )),
      )}
      <Label x={208} y={206} size={8} fill={C.dim}>
        hidden layers · weighted connections
      </Label>

      {/* Output */}
      <Label x={362} y={50} size={9} fill={C.blue}>
        OUTPUT
      </Label>
      {OUTPUTS.map((o, i) => {
        const w = step >= 3 ? o.p * 46 : 0;
        return (
          <g key={o.label}>
            <Label x={338} y={84 + i * 28} anchor="start" size={11} fill={o.label === "7" && step >= 3 ? C.green : C.text} weight={800}>
              {o.label}
            </Label>
            <rect x="350" y={75 + i * 28} width="46" height="10" rx="5" fill="#1d2c4d" />
            <rect x="350" y={75 + i * 28} width={w} height="10" rx="5" fill={o.label === "7" ? C.green : C.dim}>
              {motion && step >= 3 && <animate attributeName="width" from="0" to={String(w)} dur="0.9s" fill="freeze" />}
            </rect>
          </g>
        );
      })}
      {step >= 3 && (
        <Label x={372} y={172} size={10} fill={C.green} weight={800}>
          {`It's a 7 (92%)`}
        </Label>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 3: how encryption protects a password                          */
/* ------------------------------------------------------------------ */

const CIPHERS = ["x9#Lq@2!", "Q7$m!p0z", "k@4Zr#8w"];

function SecurityScene({ step, motion }: SceneProps) {
  const locked = step >= 1;
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label="A password is encrypted with a key, travels as scrambled text that an attacker cannot read, and is decrypted by the server">
      {/* Phone */}
      <rect x="18" y="52" width="70" height="116" rx="12" fill={C.panel} stroke={C.line} />
      <Label x={53} y={74} size={8} fill={C.dim}>
        You
      </Label>
      <rect x="28" y="90" width="50" height="20" rx="4" fill="#1d2c4d" stroke={step === 0 ? C.orange : C.line} />
      <Label x={53} y={104} size={9} fill="#fff" weight={700}>
        pa55word
      </Label>

      {/* Lock */}
      <g transform="translate(118 84)">
        <path d={locked ? "M8 18 V10 a12 12 0 0 1 24 0 V18" : "M8 18 V10 a12 12 0 0 1 24 0 V4"} fill="none" stroke={locked ? C.green : C.orange} strokeWidth="4" strokeLinecap="round">
          {motion && step === 1 && <animateTransform attributeName="transform" type="translate" values="0 -6;0 0;0 0" keyTimes="0;0.4;1" dur="1.6s" repeatCount="indefinite" />}
        </path>
        <rect x="0" y="18" width="40" height="30" rx="6" fill={locked ? C.green : C.orange} />
        <circle cx="20" cy="31" r="4" fill="#13203a" />
        <rect x="18.5" y="32" width="3" height="8" fill="#13203a" />
      </g>
      <Label x={138} y={150} size={8} fill={locked ? C.green : C.dim}>
        {locked ? "Encrypted (HTTPS)" : "Not yet encrypted"}
      </Label>

      {/* Wire */}
      <Flow x1={168} y1={110} x2={318} y2={110} motion={motion} color={locked ? C.green : C.blue} />
      {motion && (
        <g>
          <rect width="62" height="18" rx="4" x="-31" y="-9" fill="#1d2c4d" stroke={C.green} />
          <text textAnchor="middle" y="4" fontSize="9" fill={C.green} fontWeight="700" fontFamily="ui-monospace, monospace">
            {CIPHERS[0]}
            <animate attributeName="opacity" values="1;0.4;1" dur="0.5s" repeatCount="indefinite" />
          </text>
          <animateMotion dur="2.4s" repeatCount="indefinite" path="M200 110 L290 110" />
        </g>
      )}
      {!motion && (
        <g transform="translate(244 110)">
          <rect width="62" height="18" rx="4" x="-31" y="-9" fill="#1d2c4d" stroke={C.green} />
          <text textAnchor="middle" y="4" fontSize="9" fill={C.green} fontWeight="700" fontFamily="ui-monospace, monospace">
            {CIPHERS[0]}
          </text>
        </g>
      )}

      {/* Attacker */}
      <g opacity={step >= 2 ? 1 : 0.4}>
        <circle cx="244" cy="178" r="14" fill="#2a1620" stroke="#f87171" />
        <path d="M234 178 q10 -9 20 0 q-10 9 -20 0z" fill="none" stroke="#f87171" strokeWidth="1.5" />
        <circle cx="244" cy="178" r="2.5" fill="#f87171" />
        <Label x={262} y={176} anchor="start" size={8} fill="#fca5a5">
          Eavesdropper sees:
        </Label>
        <Label x={262} y={188} anchor="start" size={9} fill="#fca5a5" weight={700}>
          {step >= 2 ? CIPHERS[step % 3] : "…"}
        </Label>
        {motion && step >= 2 && <line x1="244" y1="164" x2="244" y2="122" stroke="#f87171" strokeDasharray="2 3" />}
      </g>

      {/* Server */}
      <g transform="translate(318 60)">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="0" y={i * 32} width="66" height="26" rx="5" fill={C.panel} stroke={step >= 3 ? C.green : C.line} />
            <circle cx="10" cy={13 + i * 32} r="2.5" fill={C.green}>
              {motion && <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />}
            </circle>
          </g>
        ))}
        <Label x={33} y={-8} size={8} fill={C.dim}>
          Server
        </Label>
        <Label x={36} y={115} size={9} fill={step >= 3 ? C.green : C.dim} weight={700}>
          {step >= 3 ? "🔑 pa55word ✓" : "waiting…"}
        </Label>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 4: how the internet delivers a web page                        */
/* ------------------------------------------------------------------ */

const ROUTE_A = "M48 150 L118 150 L196 70 L278 112 L352 112";
const ROUTE_B = "M48 150 L118 150 L196 172 L278 112 L352 112";
const ROUTE_BACK = "M352 112 L278 112 L196 70 L118 150 L48 150";

function NetworkScene({ step, motion }: SceneProps) {
  const nodes: Array<[number, number]> = [
    [196, 70],
    [196, 172],
    [278, 112],
  ];
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label="Packets travel from a laptop through a router and several internet routers to a server, then the page comes back">
      <Flow x1={48} y1={150} x2={118} y2={150} motion={motion} active={step >= 1} />
      <Flow x1={118} y1={150} x2={196} y2={70} motion={motion} active={step >= 2} />
      <Flow x1={118} y1={150} x2={196} y2={172} motion={motion} active={step >= 2} color={C.orange} />
      <Flow x1={196} y1={70} x2={278} y2={112} motion={motion} active={step >= 2} />
      <Flow x1={196} y1={172} x2={278} y2={112} motion={motion} active={step >= 2} color={C.orange} />
      <Flow x1={196} y1={70} x2={196} y2={172} motion={motion} active={false} />
      <Flow x1={278} y1={112} x2={352} y2={112} motion={motion} active={step >= 2} color={step >= 3 ? C.green : C.blue} />

      {/* Laptop */}
      <rect x="22" y="128" width="52" height="34" rx="4" fill={C.panel} stroke={C.blue} />
      <rect x="28" y="133" width="40" height="24" rx="2" fill="#1d2c4d" />
      <rect x="14" y="162" width="68" height="6" rx="3" fill={C.blue} />
      <Label x={48} y={186} size={8} fill={C.dim}>
        Your browser
      </Label>
      {step >= 3 && (
        <Label x={48} y={148} size={8} fill={C.green} weight={800}>
          page ✓
        </Label>
      )}

      {/* Home router */}
      <rect x="102" y="140" width="34" height="20" rx="4" fill={C.panel} stroke={C.blue} />
      <line x1="108" y1="140" x2="104" y2="128" stroke={C.blue} strokeWidth="2" />
      <line x1="130" y1="140" x2="134" y2="128" stroke={C.blue} strokeWidth="2" />
      <Label x={119} y={176} size={8} fill={C.dim}>
        Router
      </Label>

      {/* Internet routers */}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="13" fill="#13203a" stroke={C.blue} strokeWidth="1.5" />
          <path d={`M${x - 5} ${y} h10 M${x} ${y - 5} v10`} stroke={C.blue} strokeWidth="1.5" />
          {motion && step >= 2 && (
            <circle cx={x} cy={y} r="13" fill="none" stroke={C.blue}>
              <animate attributeName="r" values="13;22" dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
      <Label x={237} y={40} size={8} fill={C.dim}>
        The internet: routers pass packets hop by hop
      </Label>

      {/* Server */}
      <g transform="translate(340 82)">
        {[0, 1, 2].map((i) => (
          <rect key={i} x="0" y={i * 20} width="44" height="16" rx="3" fill={C.panel} stroke={C.blue} />
        ))}
        <Label x={22} y={78} size={8} fill={C.dim}>
          Web server
        </Label>
      </g>

      {/* Packets */}
      {motion && step >= 1 && step < 3 && (
        <>
          {[0, 0.5, 1].map((d, i) => (
            <rect key={i} width="9" height="9" rx="2" x="-4.5" y="-4.5" fill={i === 1 ? C.orange : C.blue}>
              <animateMotion dur="3s" begin={`${d}s`} repeatCount="indefinite" path={i === 1 ? ROUTE_B : ROUTE_A} />
            </rect>
          ))}
        </>
      )}
      {motion && step >= 3 &&
        [0, 0.4, 0.8].map((d) => (
          <rect key={d} width="9" height="9" rx="2" x="-4.5" y="-4.5" fill={C.green}>
            <animateMotion dur="2.6s" begin={`${d}s`} repeatCount="indefinite" path={ROUTE_BACK} />
          </rect>
        ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Explainer carousel                                                   */
/* ------------------------------------------------------------------ */

const SCENES: Array<{ id: string; tab: string; icon: IconName; title: string; steps: string[]; Scene: (p: SceneProps) => ReactNode }> = [
  {
    id: "cpu",
    tab: "Computer",
    icon: "chip",
    title: "How a CPU runs a program",
    steps: ["Fetch: read the next instruction from memory", "Load the second number into register B", "Decode & execute: the ALU adds 5 + 3", "Store: write the result 8 back to memory"],
    Scene: CpuScene,
  },
  {
    id: "ai",
    tab: "AI",
    icon: "sparkle",
    title: "How AI recognises a handwritten number",
    steps: ["The image becomes numbers — one per pixel", "Each connection has a weight learned in training", "Signals flow forward, layer by layer", "The strongest output wins: it's a 7. Wrong answers in training adjust the weights — that's learning."],
    Scene: AiScene,
  },
  {
    id: "security",
    tab: "Security",
    icon: "shield",
    title: "How encryption protects your password",
    steps: ["You type a password into a website", "HTTPS locks it with an encryption key", "Anyone listening on the network sees only scrambled data", "Only the server's key can unlock the real password"],
    Scene: SecurityScene,
  },
  {
    id: "network",
    tab: "Internet",
    icon: "server",
    title: "How the internet delivers a web page",
    steps: ["You open a website in your browser", "Your request is split into small packets", "Routers forward each packet hop by hop — even by different routes", "The server answers, and the page is rebuilt on your screen"],
    Scene: NetworkScene,
  },
];

const STEP_MS = 3200;

/**
 * Animated, step-by-step explainers of how technology works. Auto-plays
 * (pausable) and moves on to the next topic after the last step. With
 * reduced motion, nothing moves on its own; the steps can still be browsed.
 */
export function TechExplainers() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const playing = !reduced && !paused;
  const S = SCENES[scene];

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step < S.steps.length - 1) setStep(step + 1);
      else {
        setScene((scene + 1) % SCENES.length);
        setStep(0);
      }
    }, step === S.steps.length - 1 ? STEP_MS * 1.6 : STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, scene, S.steps.length]);

  const go = (i: number) => {
    setScene(i);
    setStep(0);
  };

  return (
    <section aria-labelledby="explainers-title" className="overflow-hidden rounded-[1.25rem] bg-night-900 text-white shadow-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-sun-400">Explore how tech works</p>
          <h2 id="explainers-title" className="mt-1 text-xl font-extrabold sm:text-2xl">
            {S.title}
          </h2>
        </div>
        {!reduced && (
          <button type="button" onClick={() => setPaused((p) => !p)} className="flex size-9 items-center justify-center rounded-full border border-white/20 hover:bg-white/10" aria-label={paused ? "Play animations" : "Pause animations"}>
            <Icon name={paused ? "play" : "pause"} className="size-4" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Topics" className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 sm:px-4">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === scene}
            aria-controls="explainer-panel"
            onClick={() => go(i)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${i === scene ? "bg-white text-brand-800" : "text-brand-100/80 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon name={s.icon} className="size-4" /> {s.tab}
          </button>
        ))}
      </div>

      <div id="explainer-panel" role="tabpanel" className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="relative aspect-[16/9] bg-[radial-gradient(ellipse_at_center,#13203a,#0b1426)] p-2 sm:p-4">
          <S.Scene key={S.id} step={step} motion={!reduced && !paused} />
        </div>
        <div className="flex flex-col border-t border-white/10 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <ol className="space-y-2.5">
            {S.steps.map((text, i) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex w-full gap-3 rounded-xl p-2.5 text-left text-sm transition ${i === step ? "bg-white/10 text-white" : "text-brand-100/60 hover:bg-white/5 hover:text-brand-100"}`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-leaf-500 text-white" : i === step ? "bg-sun-500 text-ink" : "bg-white/10"}`}>
                    {i < step ? <Icon name="check" className="size-3.5" /> : i + 1}
                  </span>
                  <span className="leading-relaxed">{text}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-auto flex items-center gap-2 pt-5">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost-dark px-3 py-1.5 text-xs" aria-label="Previous step">
              <Icon name="left" /> Back
            </button>
            <button
              type="button"
              onClick={() => (step < S.steps.length - 1 ? setStep(step + 1) : go((scene + 1) % SCENES.length))}
              className="btn-sun px-3 py-1.5 text-xs"
            >
              {step < S.steps.length - 1 ? "Next step" : "Next topic"} <Icon name="right" />
            </button>
            <span className="ml-auto text-xs text-brand-100/60">
              {step + 1}/{S.steps.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Motivational quotes                                                  */
/* ------------------------------------------------------------------ */

const QUOTES = [
  { text: "The best way to predict the future is to invent it.", by: "Alan Kay, computer scientist" },
  { text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.", by: "Alan Turing, 1950" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", by: "Harold Abelson & Gerald Jay Sussman, Structure and Interpretation of Computer Programs" },
  { text: "Simplicity is prerequisite for reliability.", by: "Edsger W. Dijkstra" },
  { text: "Talk is cheap. Show me the code.", by: "Linus Torvalds, creator of Linux" },
  { text: "পরিশ্রম সৌভাগ্যের প্রসূতি।", by: "বাংলা প্রবাদ — Hard work is the mother of good fortune" },
];

const QUOTE_MS = 9000;

export function QuoteRotator() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (reduced || hover) return;
    const t = setTimeout(() => setI((x) => (x + 1) % QUOTES.length), QUOTE_MS);
    return () => clearTimeout(t);
  }, [i, reduced, hover]);

  const q = QUOTES[i];
  return (
    <section
      aria-label="Motivation"
      className="relative flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-brand-600 via-brand-700 to-night-900 p-6 text-white sm:p-8"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span aria-hidden className="pointer-events-none absolute -top-6 -left-2 font-display text-[10rem] leading-none text-white/10">
        “
      </span>
      <p className="eyebrow relative text-sun-400">Daily motivation</p>
      <figure key={i} className="relative mt-4 flex-1 animate-fade-up">
        <blockquote className="font-display text-xl leading-snug font-bold sm:text-2xl">{q.text}</blockquote>
        <figcaption className="mt-4 text-sm text-brand-100/80">— {q.by}</figcaption>
      </figure>
      <div className="relative mt-6 flex items-center gap-1.5" role="tablist" aria-label="Choose a quote">
        {QUOTES.map((_, j) => (
          <button
            key={j}
            type="button"
            role="tab"
            aria-selected={j === i}
            aria-label={`Quote ${j + 1}`}
            onClick={() => setI(j)}
            className={`h-1.5 rounded-full transition-all ${j === i ? "w-6 bg-sun-400" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
          />
        ))}
      </div>
    </section>
  );
}
