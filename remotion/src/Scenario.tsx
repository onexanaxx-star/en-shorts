// Универсальный движок английских шортсов (19.10.2026): любой сценарий выживания или правдивая история
// собирается из JSON - место действия (env), опасность (hazard), герой и его действия, камера по каждой фразе,
// таблички, значки, таймер, финальная заставка. Всё рисуется плоской 2D-анимацией (как вирусные ролики).
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Music } from "./AutoInfo";
import { CoverText, CoverSpec } from "./CoverText";
import { Building, C, Car, HotCaptions, Person, rnd, Siren, Stars, Tag, Timer, Water, World } from "./flat";
import { smooth } from "./GimliRecon";
import { clamp, Word } from "./infokit";

export type Env = "beach" | "city" | "forest" | "mountain" | "desert" | "home" | "ice" | "highway";
export type Hazard = "water" | "fire" | "snow" | "dark" | "smoke" | "quake" | "storm" | "ice" | "heat" | "none";
export type Focus = "hero" | "shelter" | "top" | "hazard" | "crowd" | "wide" | "sky";
export type Action = "stand" | "walk_to_shelter" | "climb_shelter" | "enter_shelter" | "run_away" | "crouch" | "wave" | "look";
export type Icon =
  | "water" | "phone" | "no_signal" | "flashlight" | "map" | "fire" | "rope" | "car" | "key" | "clock" | "bag" | "compass"
  | "warning" | "heart" | "door" | "snow" | "food" | "radio" | "money" | "plane" | "skull" | "question";

export type Shot = { focus: Focus; zoom?: "close" | "medium" | "wide"; tag?: string; tagColor?: "red" | "yellow" | "green"; hero?: Action; icon?: Icon; iconText?: string; fx?: "recede" | "lights_off" };
export type ScenarioSpec = {
  env: Env;
  time?: "night" | "day" | "dusk";
  hero: { name: string; color?: string };
  heroStart?: "ground" | "door" | "top" | "inside";
  crowd?: boolean | number; // true или номер фразы, на которой толпа срывается с места
  hazard: { type: Hazard; line: number };
  timer?: { label: string; minutes: number; startLine: number; endLine: number; after?: string };
  shots: Shot[];
  hot?: Record<string, string>;
  ending: string;
  endingSub?: string;
};
export type ScenarioProps = {
  id: string;
  total: number;
  segments: { text: string; start: number; end: number }[];
  words: Word[];
  spec: ScenarioSpec;
  music?: string;
  sfx?: { s: string; at: number; v: number }[];
  cover?: CoverSpec; // кадр-обложка: без табличек, таймера и субтитров, с крупным текстом
};

const W = 3600, G = 1500;
type Anchor = { hero: number; crowd: number; shelter: { x: number; w: number; h: number; kind: "building" | "cabin" | "rock" | "house" | "car" | "tree" }; hazardFrom: "left" | "right" };
const ENVS: Record<Env, Anchor> = {
  beach: { hero: 1180, crowd: 1000, shelter: { x: 2350, w: 420, h: 700, kind: "building" }, hazardFrom: "left" },
  city: { hero: 1500, crowd: 1250, shelter: { x: 2300, w: 440, h: 840, kind: "building" }, hazardFrom: "right" },
  forest: { hero: 1300, crowd: 1100, shelter: { x: 2350, w: 360, h: 260, kind: "cabin" }, hazardFrom: "right" },
  mountain: { hero: 1300, crowd: 1150, shelter: { x: 2300, w: 420, h: 300, kind: "rock" }, hazardFrom: "right" },
  desert: { hero: 1350, crowd: 1150, shelter: { x: 2300, w: 460, h: 280, kind: "rock" }, hazardFrom: "right" },
  home: { hero: 1250, crowd: 1050, shelter: { x: 2000, w: 900, h: 560, kind: "house" }, hazardFrom: "right" },
  ice: { hero: 1500, crowd: 1250, shelter: { x: 2600, w: 500, h: 220, kind: "tree" }, hazardFrom: "left" },
  highway: { hero: 1500, crowd: 1250, shelter: { x: 1900, w: 120, h: 60, kind: "car" }, hazardFrom: "right" },
};

const PAL = {
  night: { sky1: "#0F1424", sky2: "#1C2540", ground: "#1A1F2B" },
  dusk: { sky1: "#2A2140", sky2: "#7A4A5E", ground: "#241F2A" },
  day: { sky1: "#5DA9E9", sky2: "#BDE0F6", ground: "#5B6A3E" },
};
const TAGC = { red: C.red, yellow: C.yellow, green: C.green };

// ---------- значки (простые SVG) ----------
const IconSvg: React.FC<{ icon: Icon }> = ({ icon }) => {
  const s = { stroke: "#111", strokeWidth: 6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "water": return <path d="M50 12 C 30 40 22 55 22 68 a28 28 0 0 0 56 0 C78 55 70 40 50 12 Z" fill="#4FC3F7" stroke="#111" strokeWidth={5} />;
    case "phone": return <g><rect x={30} y={10} width={40} height={80} rx={8} fill="#2B2F3A" /><rect x={36} y={20} width={28} height={52} fill="#9FC3D9" /></g>;
    case "no_signal": return <g><rect x={30} y={10} width={40} height={80} rx={8} fill="#2B2F3A" /><rect x={36} y={20} width={28} height={52} fill="#555" /><path d="M20 20 L80 80" stroke={C.red} strokeWidth={9} /></g>;
    case "flashlight": return <g><rect x={14} y={40} width={44} height={22} rx={5} fill="#3A3F4B" /><path d="M58 36 L72 30 L72 72 L58 66 Z" fill="#6B7180" /><path d="M72 30 L96 14 L96 88 L72 72 Z" fill={C.yellow} opacity={0.8} /></g>;
    case "map": return <g><path d="M10 22 L36 12 L64 22 L90 12 L90 80 L64 90 L36 80 L10 90 Z" fill="#F1E3B8" stroke="#111" strokeWidth={4} /><path d="M30 60 Q50 30 72 50" stroke={C.red} strokeWidth={5} fill="none" strokeDasharray="6 6" /></g>;
    case "fire": return <path d="M50 8 C60 30 80 40 74 66 a24 24 0 0 1 -48 0 C24 50 36 44 40 30 C44 42 50 44 50 8 Z" fill="#FF8A3D" stroke="#111" strokeWidth={4} />;
    case "rope": return <g><circle cx={50} cy={50} r={30} {...s} stroke="#C9A36B" strokeWidth={10} /><circle cx={50} cy={50} r={16} {...s} stroke="#C9A36B" strokeWidth={8} /></g>;
    case "car": return <g transform="translate(50 70) scale(0.9)"><Car x={0} y={0} color={C.red} /></g>;
    case "key": return <g><circle cx={32} cy={50} r={18} {...s} strokeWidth={8} stroke={C.yellow} /><path d="M50 50 L90 50 M78 50 L78 64 M88 50 L88 62" {...s} strokeWidth={8} stroke={C.yellow} /></g>;
    case "clock": return <g><circle cx={50} cy={50} r={38} fill="#fff" stroke="#111" strokeWidth={6} /><path d="M50 50 L50 24 M50 50 L68 60" {...s} /></g>;
    case "bag": return <g><rect x={22} y={30} width={56} height={58} rx={10} fill="#6D8A4E" stroke="#111" strokeWidth={4} /><path d="M38 30 Q50 6 62 30" {...s} /></g>;
    case "compass": return <g><circle cx={50} cy={50} r={38} fill="#fff" stroke="#111" strokeWidth={6} /><path d="M50 18 L60 50 L50 82 L40 50 Z" fill={C.red} /><path d="M50 50 L60 50 L50 82 L40 50 Z" fill="#555" /></g>;
    case "warning": return <g><path d="M50 10 L92 86 L8 86 Z" fill={C.yellow} stroke="#111" strokeWidth={5} /><path d="M50 36 L50 62 M50 72 L50 74" {...s} strokeWidth={9} /></g>;
    case "heart": return <path d="M50 86 C10 58 8 30 30 20 C42 15 50 26 50 30 C50 26 58 15 70 20 C92 30 90 58 50 86 Z" fill={C.red} stroke="#111" strokeWidth={4} />;
    case "door": return <g><rect x={26} y={10} width={48} height={82} fill="#8B5E3C" stroke="#111" strokeWidth={5} /><circle cx={64} cy={52} r={5} fill={C.yellow} /></g>;
    case "snow": return <g {...s} stroke="#BFE6FF" strokeWidth={8}><path d="M50 10 L50 90 M15 30 L85 70 M15 70 L85 30" /></g>;
    case "food": return <g><rect x={24} y={30} width={52} height={56} rx={6} fill="#E9C46A" stroke="#111" strokeWidth={4} /><rect x={24} y={44} width={52} height={16} fill={C.red} /></g>;
    case "radio": return <g><rect x={14} y={34} width={72} height={50} rx={8} fill="#3A3F4B" /><circle cx={34} cy={59} r={12} fill="#888" /><rect x={54} y={48} width={22} height={8} fill={C.green} /><path d="M70 34 L84 10" {...s} stroke="#888" /></g>;
    case "money": return <g><rect x={10} y={28} width={80} height={46} rx={6} fill="#6BBF59" stroke="#111" strokeWidth={4} /><circle cx={50} cy={51} r={13} fill="#3E8E35" /></g>;
    case "plane": return <path d="M50 8 L56 40 L92 56 L92 64 L56 56 L54 80 L64 88 L64 92 L50 88 L36 92 L36 88 L46 80 L44 56 L8 64 L8 56 L44 40 Z" fill="#E8ECF2" stroke="#111" strokeWidth={4} />;
    case "skull": return <g><circle cx={50} cy={44} r={30} fill="#EEE" stroke="#111" strokeWidth={4} /><circle cx={39} cy={44} r={8} fill="#111" /><circle cx={61} cy={44} r={8} fill="#111" /><rect x={38} y={70} width={24} height={16} fill="#EEE" stroke="#111" strokeWidth={4} /></g>;
    default: return <text x={50} y={74} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={70} fill="#111">?</text>;
  }
};

const Bubble: React.FC<{ x: number; y: number; icon: Icon; text?: string; k: number }> = ({ x, y, icon, text, k }) => {
  // подпись - внутри пузыря под значком, чтобы не наезжать на таблички
  const h = text ? 196 : 150;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.6 + 0.4 * k})`} opacity={k}>
      <rect x={-84} y={-h - 20} width={168} height={h} rx={26} fill="#F4F2EE" stroke="#C9CDD4" strokeWidth={3} />
      <path d="M-16 -22 L0 0 L16 -22 Z" fill="#F4F2EE" />
      <g transform={`translate(-50 ${-h - 10})`}>
        <IconSvg icon={icon} />
      </g>
      {text ? (
        <text x={0} y={-36} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={32} fill="#1F2430">
          {text.slice(0, 10)}
        </text>
      ) : null}
    </g>
  );
};

// ---------- места действия ----------
const Pine: React.FC<{ x: number; y: number; s?: number; snow?: number; sway?: number }> = ({ x, y, s = 1, snow = 0, sway = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) skewX(${sway})`}>
    <rect x={-8} y={-40} width={16} height={40} fill="#3B2A1E" />
    <path d="M0 -260 L70 -110 L35 -110 L90 -40 L-90 -40 L-35 -110 L-70 -110 Z" fill="#1F4A35" />
    {snow > 0 ? <path d="M0 -260 L30 -196 L-30 -196 Z M-40 -110 L40 -110 L52 -94 L-52 -94 Z" fill="#EAF4FB" opacity={snow} /> : null}
  </g>
);

const Backdrop: React.FC<{ env: Env; time: "night" | "day" | "dusk"; t: number; hz: Hz; recede: number; jamT: number }> = ({ env, time, t, hz, recede, jamT }) => {
  const pal = PAL[time];
  const a = ENVS[env];
  const sh = a.shelter;
  const darkOff = hz.type === "dark" ? hz.p : 0;
  const lit = 0.45 * (1 - darkOff);
  const snowOn = env === "mountain" || env === "ice" || hz.type === "snow" ? 1 : 0;
  const sway = hz.type === "storm" ? Math.sin(t * 3) * 8 * hz.p : hz.type === "snow" ? Math.sin(t * 2) * 3 * hz.p : 0;
  const els: React.ReactNode[] = [];
  // небо
  els.push(
    <defs key="d">
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={pal.sky1} />
        <stop offset="1" stopColor={pal.sky2} />
      </linearGradient>
    </defs>,
    <rect key="sky" x={-2000} y={-2000} width={W + 4000} height={G + 2000} fill="url(#sky)" />,
  );
  if (env === "beach") els.push(<rect key="hz" x={-2000} y={G - 40} width={2900} height={4} fill="#3A6E92" opacity={0.6} />);
  if (time === "night") els.push(<Stars key="st" w={W} />, <circle key="moon" cx={700} cy={420} r={70} fill="#E8E4D8" opacity={0.85} />);
  else if (time === "dusk") els.push(<circle key="sun" cx={900} cy={G - 260} r={140} fill="#FFB36B" opacity={0.85} />);
  else els.push(<circle key="sun" cx={900} cy={350} r={hz.type === "heat" ? 130 + 60 * hz.p : 110} fill="#FFE27A" />);
  // дальний план
  if (env === "city" || env === "beach" || env === "highway")
    els.push(...Array.from({ length: 16 }).map((_, k) => <rect key={`far${k}`} x={1100 + k * 170} y={G - 260 - rnd(k) * 380} width={150} height={600} fill={time === "day" ? "#9DB3C8" : "#161C2C"} />));
  if (env === "mountain" || env === "forest" || env === "ice")
    els.push(
      <path key="mtn" d={`M-1000 ${G} L200 ${G - 700} L700 ${G - 300} L1300 ${G - 900} L1900 ${G - 350} L2500 ${G - 820} L3200 ${G - 280} L4200 ${G - 700} L5000 ${G} Z`}
        fill={time === "day" ? "#7D8FA6" : "#232B3E"} />,
      <path key="mtns" d={`M1300 ${G - 900} L1440 ${G - 700} L1180 ${G - 720} Z M2500 ${G - 820} L2640 ${G - 640} L2370 ${G - 660} Z M200 ${G - 700} L320 ${G - 560} L90 ${G - 570} Z`}
        fill="#EAF4FB" opacity={0.85} />,
    );
  if (env === "desert")
    els.push(
      <path key="dune1" d={`M-1000 ${G} Q 400 ${G - 380} 1500 ${G - 60} Q 2400 ${G - 420} 4600 ${G} Z`} fill="#D9A55B" />,
      <path key="dune2" d={`M-1000 ${G} Q 900 ${G - 220} 2000 ${G - 20} Q 3000 ${G - 200} 4600 ${G} Z`} fill="#C88E45" />,
    );
  // земля
  const groundCol = env === "beach" ? C.ground : env === "desert" ? "#C88E45" : env === "ice" ? "#BFD8E6" : env === "mountain" ? "#DCE7EE" : env === "forest" ? (snowOn ? "#DCE7EE" : "#2E4A2A") : env === "home" ? "#3E5A34" : pal.ground;
  els.push(<rect key="gr" x={-2000} y={G} width={W + 4000} height={1200} fill={groundCol} />);
  if (env === "beach")
    els.push(
      <path key="seabed" d={`M-2000 ${G + 420} L300 ${G + 90} L700 ${G + 14} L1260 ${G + 4} L1260 2600 L-2000 2600 Z`} fill="#7C6A48" />,
      <Water key="sea" level={G - 20 + 14 * recede} front={900 - 480 * recede} t={t} w={W} />,
      <path key="sand" d={`M700 ${G + 6} L1260 ${G - 4} L1260 2400 L700 2400 Z`} fill={time === "night" ? "#9C8A63" : C.sand} />,
    );
  if (env === "city" || env === "beach" || env === "highway") {
    const r0 = env === "beach" ? 1260 : -2000;
    els.push(
      <rect key="earth" x={r0} y={G} width={W + 4000} height={1200} fill={time === "day" ? "#5B6170" : "#3A3E48"} />,
      <rect key="asph" x={r0} y={G - 4} width={W + 4000} height={64} fill="#2E333E" />,
      <rect key="curb" x={r0} y={G - 10} width={W + 4000} height={8} fill="#8A909B" />,
      <rect key="curb2" x={r0} y={G + 60} width={W + 4000} height={8} fill="#6B717C" />,
    );
    els.push(...Array.from({ length: 60 }).map((_, k) => <rect key={`mk${k}`} x={r0 + 20 + k * 110} y={G + 26} width={54} height={5} rx={2} fill="#C9CCD2" opacity={0.75} />));
  }
  if (env === "beach")
    els.push(
      <rect key="wall" x={1236} y={G - 14} width={28} height={90} fill="#6E737D" />,
      <rect key="wall2" x={1232} y={G - 18} width={36} height={8} fill="#9AA0AA" />,
      ...[760, 1080].map((x, k) => (
        <g key={`palm${k}`} transform={`translate(${x} ${G + 10})`}>
          <path d={`M0 0 Q${k ? -18 : 18} -140 ${k ? 10 : -10} -270`} stroke="#6B4A2B" strokeWidth={16} fill="none" strokeLinecap="round" />
          {[-60, -25, 15, 50, 85, 130].map((a, j) => (
            <path key={j} d={`M${k ? 10 : -10} -270 q${Math.cos((a * Math.PI) / 180) * 80} ${-30 + Math.abs(a) * 0.4} ${Math.cos((a * Math.PI) / 180) * 150} ${50 + Math.sin(t * 1.5 + j) * 4}`}
              stroke="#2F6B43" strokeWidth={14} fill="none" strokeLinecap="round" />
          ))}
        </g>
      )),
      ...[880, 990].map((x, k) => (
        <g key={`umb${k}`} transform={`translate(${x} ${G + 8})`}>
          <rect x={-2} y={-120} width={4} height={120} fill="#D8D2C4" />
          <path d="M-60 -110 Q0 -165 60 -110 Z" fill={k ? "#E63946" : "#F4A261"} />
          <path d="M-20 -110 Q0 -158 20 -110" fill="#F4F2EE" opacity={0.85} />
        </g>
      )),
      <g key="tower" transform={`translate(1160 ${G + 4})`}>
        <path d="M-40 0 L-26 -150 M40 0 L26 -150 M-34 -60 L34 -60" stroke="#C9B37E" strokeWidth={8} />
        <rect x={-46} y={-210} width={92} height={62} fill="#E63946" stroke="#7A1E26" strokeWidth={4} />
        <rect x={-34} y={-198} width={68} height={26} fill="#2E3B4E" />
        <path d="M-56 -210 L0 -240 L56 -210 Z" fill="#F4F2EE" />
      </g>,
      hz.type === "water" ? <Siren key="siren" x={1330} y={G - 10} t={t} on={hz.p < 0.3 ? 1 : 0} /> : null,
    );
  if (env === "ice")
    els.push(
      <rect key="shore" x={2450} y={G - 6} width={W} height={12} fill="#EAF4FB" />,
      ...Array.from({ length: 7 }).map((_, k) => <path key={`crk${k}`} d={`M${300 + k * 280} ${G + 40} l40 30 l-30 40 l50 50`} stroke="#8FB7CC" strokeWidth={4} fill="none" />),
    );
  // деревья / кактусы / дома второго плана
  if (env === "forest" || env === "mountain" || env === "ice")
    els.push(...Array.from({ length: env === "forest" ? 22 : 9 }).map((_, k) => {
      const x = env === "ice" ? 2500 + k * 140 : -200 + k * 190 + rnd(k) * 60;
      if (Math.abs(x - sh.x - sh.w / 2) < sh.w * 0.6) return null;
      return <Pine key={`pn${k}`} x={x} y={G + 4} s={0.8 + rnd(k + 3) * 0.6} snow={snowOn} sway={sway} />;
    }));
  if (env === "desert")
    els.push(...[600, 1700, 3000].map((x, k) => (
      <g key={`cac${k}`} transform={`translate(${x} ${G})`} fill="#3E7A4A">
        <rect x={-14} y={-200} width={28} height={200} rx={14} />
        <rect x={-60} y={-130} width={22} height={70} rx={11} />
        <rect x={-60} y={-80} width={60} height={22} rx={11} />
        <rect x={38} y={-160} width={22} height={80} rx={11} />
        <rect x={0} y={-100} width={60} height={22} rx={11} />
      </g>
    )));
  if (env === "city") {
    els.push(<Building key="b1" x={1550} base={G} w={300} floors={6} seed={2} lit={lit} color="#59627A" />);
    els.push(<Building key="b2" x={2950} base={G} w={320} floors={7} seed={4} lit={lit} color="#59627A" />);
    els.push(...[1000, 1900, 2800, 3300].map((x, k) => (
      <g key={`lamp${k}`}>
        <rect x={x - 4} y={G - 220} width={8} height={220} fill="#4A5163" />
        <circle cx={x + 18} cy={G - 220} r={12} fill={darkOff > 0.5 ? "#333" : C.win} />
      </g>
    )));
  }
  if (env === "beach" || env === "highway") {
    els.push(<Building key="b3" x={1900} base={G} w={260} floors={3} seed={3} lit={lit} color="#6E7686" />);
    els.push(<Building key="b4" x={2900} base={G} w={300} floors={4} seed={5} lit={lit} color="#6E7686" />);
  }
  // укрытие
  if (sh.kind === "building")
    els.push(<Building key="sh" x={sh.x} base={G} w={sh.w} floors={Math.round(sh.h / 70)} seed={9} lit={lit + 0.05} />);
  if (sh.kind === "cabin")
    els.push(
      <g key="sh">
        <rect x={sh.x} y={G - sh.h + 90} width={sh.w} height={sh.h - 90} fill="#7A4E2D" />
        {Array.from({ length: 5 }).map((_, k) => <rect key={k} x={sh.x} y={G - sh.h + 100 + k * 34} width={sh.w} height={4} fill="#5A3820" />)}
        <path d={`M${sh.x - 40} ${G - sh.h + 96} L${sh.x + sh.w / 2} ${G - sh.h - 40} L${sh.x + sh.w + 40} ${G - sh.h + 96} Z`} fill={snowOn ? "#EAF4FB" : "#4A2E1B"} />
        <rect x={sh.x + sh.w / 2 - 34} y={G - 120} width={68} height={120} fill="#3B2414" />
        <rect x={sh.x + 40} y={G - 170} width={70} height={56} fill={darkOff > 0.5 ? "#222" : C.win} />
      </g>,
    );
  if (sh.kind === "rock")
    els.push(
      <g key="sh">
        <path d={`M${sh.x - 80} ${G} Q${sh.x} ${G - sh.h - 40} ${sh.x + sh.w / 2} ${G - sh.h} Q${sh.x + sh.w} ${G - sh.h + 20} ${sh.x + sh.w + 80} ${G} Z`} fill={env === "desert" ? "#A0643A" : "#5D6574"} />
        <path d={`M${sh.x + 60} ${G} Q${sh.x + sh.w / 2} ${G - sh.h * 0.6} ${sh.x + sh.w - 60} ${G} Z`} fill="#1B1E26" />
        {snowOn ? <path d={`M${sh.x - 40} ${G - 40} Q${sh.x + 20} ${G - sh.h - 30} ${sh.x + sh.w / 2} ${G - sh.h + 10} Q${sh.x + sh.w * 0.8} ${G - sh.h + 30} ${sh.x + sh.w} ${G - sh.h * 0.7}`} stroke="#EAF4FB" strokeWidth={22} fill="none" /> : null}
      </g>,
    );
  if (sh.kind === "house")
    els.push(
      <g key="sh">
        {/* дом в разрезе: 2 этажа и подвал */}
        <rect x={sh.x} y={G - sh.h} width={sh.w} height={sh.h} fill="#D9CDB8" />
        <path d={`M${sh.x - 50} ${G - sh.h} L${sh.x + sh.w / 2} ${G - sh.h - 220} L${sh.x + sh.w + 50} ${G - sh.h} Z`} fill="#8C3B2E" />
        <rect x={sh.x} y={G - sh.h / 2 - 6} width={sh.w} height={12} fill="#7B6A55" />
        <rect x={sh.x + sh.w / 2 - 6} y={G - sh.h} width={12} height={sh.h} fill="#7B6A55" />
        <rect x={sh.x} y={G} width={sh.w} height={260} fill="#4A4036" />
        <rect x={sh.x + 40} y={G + 20} width={sh.w - 80} height={220} fill="#5E5246" />
        {[0, 1].map((f) => [0, 1].map((c) => (
          <rect key={`${f}${c}`} x={sh.x + 80 + c * (sh.w / 2)} y={G - sh.h + 60 + f * (sh.h / 2)} width={140} height={110} fill={darkOff > 0.5 ? "#333" : "#9FC3D9"} stroke="#7B6A55" strokeWidth={8} />
        )))}
        <path d={`M${sh.x + sh.w - 160} ${G} L${sh.x + sh.w - 60} ${G + 240}`} stroke="#7B6A55" strokeWidth={10} />
      </g>,
    );
  if (sh.kind === "tree")
    els.push(<g key="sh">{[0, 1, 2].map((k) => <Pine key={k} x={sh.x + 80 + k * 160} y={G} s={1.4} snow={1} sway={sway} />)}</g>);
  if (sh.kind === "car") els.push(<Car key="sh" x={sh.x} y={G - 2} color="#E63946" s={1.6} brake />);
  if (env === "beach" || env === "city")
    els.push(...Array.from({ length: 11 }).map((_, k) => (
      <Car key={`jam${k}`} x={(env === "beach" ? 1330 : 400) + k * 92 + Math.min(jamT, 6) * 2} y={G - 2} color={["#E63946", "#F1FAEE", "#FFB703", "#219EBC", "#8338EC", "#FB8500", "#2A9D8F", "#E9C46A", "#6D597A", "#F4A261", "#90BE6D"][k]} s={0.95} brake />
    )));
  if (env === "highway")
    els.push(...Array.from({ length: 9 }).map((_, k) => <Car key={`hc${k}`} x={500 + k * 160 + (k > 7 ? 600 : 0)} y={G - 2} color={["#219EBC", "#FFB703", "#8338EC", "#F1FAEE", "#2A9D8F"][k % 5]} s={0.95} brake />));
  return <g>{els}</g>;
};

// ---------- опасность ----------
type Hz = { type: Hazard; p: number; t0: number };

const HazardFx: React.FC<{ hz: Hz; t: number; env: Env; heroX: number }> = ({ hz, t, env, heroX }) => {
  const from = ENVS[env].hazardFrom;
  const p = hz.p;
  if (p <= 0) return null;
  const dir = from === "left" ? 1 : -1;
  const start = from === "left" ? -400 : W + 400;
  const front = start + dir * (W + 800) * Math.min(1, p * 1.2);
  switch (hz.type) {
    case "water": {
      const lvl = G - 20 - 220 * smooth(p, [0.3, 1], [0, 1]);
      if (from === "left") return <Water level={lvl} front={front} t={t} w={W} crest={p > 0 && p < 0.8} />;
      return <g transform={`translate(${W} 0) scale(-1 1)`}><Water level={lvl} front={W - front} t={t} w={W} crest={p > 0 && p < 0.8} /></g>;
    }
    case "fire": {
      const x0 = from === "left" ? -400 : front, x1 = from === "left" ? front : W + 400;
      return (
        <g>
          <rect x={-2000} y={-2000} width={W + 4000} height={G + 2000} fill="#FF6A2A" opacity={0.18 * p} />
          {Array.from({ length: 60 }).map((_, k) => {
            const x = x0 + ((x1 - x0) * k) / 60;
            const h = 120 + rnd(k) * 160 + Math.sin(t * 8 + k) * 30;
            return <path key={k} d={`M${x - 40} ${G} Q${x - 10} ${G - h * 0.6} ${x} ${G - h} Q${x + 14} ${G - h * 0.5} ${x + 40} ${G} Z`} fill={k % 3 ? "#FF8A3D" : "#FFC83D"} opacity={0.9} />;
          })}
          {Array.from({ length: 16 }).map((_, k) => (
            <circle key={`sm${k}`} cx={x0 + ((x1 - x0) * k) / 16 + Math.sin(t + k) * 30} cy={G - 380 - ((t * 60 + k * 50) % 500)} r={70 + rnd(k) * 60} fill="#3A3A40" opacity={0.45} />
          ))}
        </g>
      );
    }
    case "snow":
    case "storm": {
      const n = Math.round(160 * Math.min(1, p * 1.5));
      const snow = hz.type === "snow";
      return (
        <g>
          {snow ? <rect x={-2000} y={G - 30 * p} width={W + 4000} height={60} fill="#EAF4FB" /> : null}
          {Array.from({ length: n }).map((_, k) => {
            const x = (rnd(k) * (W + 2000) - 1000 + t * (snow ? 160 : 400) * (1 + rnd(k + 5))) % (W + 2000) - 500;
            const y = (rnd(k + 9) * 1900 + t * (snow ? 220 : 1400) * (0.7 + rnd(k + 3))) % 1900 - 300 + 0;
            return snow ? <circle key={k} cx={x} cy={y} r={3 + rnd(k + 7) * 5} fill="#fff" opacity={0.85} /> : <path key={k} d={`M${x} ${y} l-14 46`} stroke="#9FC3D9" strokeWidth={3} opacity={0.6} />;
          })}
          {!snow && Math.sin(t * 2.3) > 0.97 ? <rect x={-2000} y={-2000} width={W + 4000} height={G + 3000} fill="#fff" opacity={0.6} /> : null}
          {!snow ? (
            <g transform={`translate(${front} ${G})`} opacity={Math.min(1, p * 2)}>
              <path d="M-40 0 C-60 -200 -180 -500 -260 -760 L260 -760 C180 -500 60 -200 40 0 Z" fill="#4A4F5C" opacity={0.85} />
              {[0, 1, 2, 3].map((k) => <path key={k} d={`M${-200 + k * 30} ${-640 + k * 140} Q0 ${-600 + k * 140 + Math.sin(t * 6 + k) * 20} ${200 - k * 30} ${-640 + k * 140}`} stroke="#6B7180" strokeWidth={10} fill="none" />)}
            </g>
          ) : null}
          {snow ? <rect x={-2000} y={-2000} width={W + 4000} height={G + 3000} fill="#DDE8F0" opacity={0.25 * p} /> : null}
        </g>
      );
    }
    case "smoke":
      return (
        <g>
          {Array.from({ length: 40 }).map((_, k) => (
            <circle key={k} cx={(from === "left" ? -200 : W + 200) + dir * ((W + 400) * p * rnd(k)) + Math.sin(t * 0.7 + k) * 40} cy={G - 200 - rnd(k + 3) * 900 + Math.sin(t + k) * 20} r={120 + rnd(k + 6) * 120} fill="#5A5D66" opacity={0.35 * p} />
          ))}
        </g>
      );
    case "quake":
      return (
        <g>
          {Array.from({ length: 8 }).map((_, k) => (
            <path key={k} d={`M${400 + k * 400} ${G} l30 40 l-20 40 l40 60`} stroke="#0A0A0A" strokeWidth={8} fill="none" opacity={Math.min(1, p * 2)} />
          ))}
          {Array.from({ length: 24 }).map((_, k) => {
            const fall = ((t - hz.t0) * 1.4 + rnd(k)) % 1;
            return <rect key={`db${k}`} x={1400 + rnd(k + 2) * 2000} y={G - 900 + fall * 900} width={20 + rnd(k) * 30} height={14 + rnd(k + 1) * 20} fill="#8A93A3" opacity={p * (1 - fall * 0.3)} />;
          })}
        </g>
      );
    case "ice":
      return (
        <g opacity={Math.min(1, p * 1.5)}>
          {Array.from({ length: 10 }).map((_, k) => {
            const a = (k / 10) * Math.PI * 2;
            const len = 80 + 520 * p * (0.5 + rnd(k) * 0.5);
            return <path key={k} d={`M${heroX} ${G + 10} L${heroX + Math.cos(a) * len * 0.5} ${G + 10 + Math.sin(a) * 18} L${heroX + Math.cos(a) * len} ${G + 10 + Math.sin(a) * 30}`} stroke="#2B5D7A" strokeWidth={5} fill="none" />;
          })}
          {p > 0.7 ? <ellipse cx={heroX} cy={G + 26} rx={120 * (p - 0.7) * 3} ry={20} fill="#0E2A3D" /> : null}
        </g>
      );
    case "heat":
      return <rect x={-2000} y={-2000} width={W + 4000} height={G + 3000} fill="#FF8A3D" opacity={0.12 * p} />;
    default:
      return null;
  }
};

// ---------- движок ----------
export const Scenario: React.FC<ScenarioProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const spec = p.spec;
  const env = spec.env;
  const A = ENVS[env];
  const sh = A.shelter;
  const s = [...p.segments.map((x) => x.start), p.total];
  const n = p.segments.length;
  const end = p.segments[n - 1].end;
  const f = (x: number) => Math.round(x * fps);
  const time = spec.time ?? "night";

  // опасность
  const ht0 = s[Math.min(n - 1, spec.hazard.line)];
  const hz: Hz = { type: spec.hazard.type, t0: ht0, p: smooth(t, [ht0, ht0 + 4, ht0 + 30], [0, 0.75, 1]) };

  // герой: идём по фразам и применяем действия
  const door = sh.x + sh.w / 2;
  const away = A.hazardFrom === "left" ? 1 : -1;
  let hx = A.hero, hy = G, hidden = 0, crouch = 0, waving = false, walking = false, dir = A.hazardFrom === "left" ? 1 : -1, running = false;
  const hs = spec.heroStart ?? "ground";
  if (hs !== "ground") hx = door;
  if (hs === "top") hy = G - (sh.kind === "house" ? 0 : sh.h);
  if (hs === "inside") {
    if (sh.kind === "house") hy = G - 20;
    else hidden = 1;
  }
  for (let i = 0; i < n; i++) {
    const a = spec.shots[i]?.hero ?? "stand";
    const k = smooth(t, [s[i] + 0.2, Math.max(s[i] + 0.8, s[i + 1] - 0.2)], [0, 1]);
    if (t < s[i]) break;
    const moving = k > 0 && k < 1;
    if (a === "walk_to_shelter") { if (moving) { dir = door >= hx ? 1 : -1; running = Math.abs(door - hx) > 500; } hx = hx + (door - hx) * k; walking = walking || moving; }
    else if (a === "run_away") { if (moving) { dir = away; running = true; } hx = hx + away * 520 * k; walking = walking || moving; if (k > 0) hidden = Math.min(hidden, 1 - k); }
    else if (a === "climb_shelter") {
      hx = hx + (door - hx) * Math.min(1, k * 4);
      hy = G - (sh.kind === "house" ? 0 : sh.h) * smooth(k, [0.25, 1], [0, 1]);
      walking = walking || moving;
    } else if (a === "enter_shelter") {
      hx = hx + (door - hx) * Math.min(1, k * 1.5);
      if (sh.kind === "house") hy = G + 230 * smooth(k, [0.6, 1], [0, 1]);
      else hidden = smooth(k, [0.7, 1], [0, 1]);
      walking = walking || moving;
    }
    crouch = a === "crouch" ? k : i === n - 1 ? crouch : a === "stand" ? crouch : 0;
    waving = a === "wave" && t < s[i + 1];
  }
  if (sh.kind === "house" && hy > G) hidden = 0;

  // камера по фразам
  const hzFront = () => {
    const from = A.hazardFrom;
    return from === "left" ? Math.min(hx - 300, -400 + (W + 800) * Math.min(1, hz.p * 1.2)) : Math.max(hx + 300, W + 400 - (W + 800) * Math.min(1, hz.p * 1.2));
  };
  const zoomOf = (z?: string) => (z === "close" ? 2.3 : z === "wide" ? 0.95 : 1.4);
  const target = (sh2: Shot, hxx: number, hyy: number): [number, number] => {
    switch (sh2.focus) {
      case "hero": return [hxx, hyy - 110];
      case "shelter": return [sh.x + sh.w / 2, G - Math.max(220, sh.h / 2)];
      case "top": return [sh.x + sh.w / 2, G - sh.h + 40];
      case "hazard": return [Math.max(400, Math.min(W - 400, hzFront())), G - 260];
      case "crowd": return [A.crowd + 250, G - 160];
      case "sky": return [hxx, G - 820];
      default: return [(hxx + (A.hazardFrom === "left" ? 600 : W - 600)) / 2, G - 380];
    }
  };
  // ключевые кадры камеры: в начале фразы + 1с выходим на план, к концу фразы - лёгкий наезд
  const keys: { t: number; x: number; y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const sh2 = spec.shots[i] ?? { focus: "hero" };
    // позицию героя для камеры берём в середине фразы (приблизительно - на момент её конца)
    const [x, y] = target(sh2, hx, hy);
    const z = zoomOf(sh2.zoom);
    const yAdj = sh2.focus === "hero" || sh2.focus === "crowd" || sh2.focus === "hazard" ? Math.min(y, G - 300 / z) : y;
    const yy = yAdj - (sh2.tag ? 60 : 0); // есть табличка - камера чуть выше, чтобы она не уходила за край
    keys.push({ t: s[i] + (i ? 0.9 : 0), x, y: yy, z });
    keys.push({ t: Math.max(s[i] + 1.0, s[i + 1] - 0.05), x, y: yy, z: z * 1.06 });
  }
  keys.push({ ...keys[keys.length - 1], t: p.total });
  // тряска при землетрясении
  const shake = hz.type === "quake" ? Math.sin(t * 40) * 18 * Math.max(0, 1 - (t - ht0) / 8) * (t > ht0 ? 1 : 0) : 0;
  const cam = keys.map((k2) => ({ ...k2, x: k2.x + shake }));

  // таблички, значки, таймер
  const endK = smooth(t, [s[n - 1] - 0.1, s[n - 1] + 0.7], [0, 1]);
  const tagK = (i: number) => Math.min(smooth(t, [s[i] + 0.35, s[i] + 0.75], [0, 1]), 1 - smooth(t, [s[i + 1] - 0.2, s[i + 1] + 0.1], [0, 1]));
  const tm = spec.timer;
  const tStart = tm ? s[Math.min(n - 1, tm.startLine)] + 0.4 : 0;
  const tEnd = tm ? s[Math.min(n, tm.endLine)] : 0;
  const secs = tm ? interpolate(t, [tStart, tEnd], [tm.minutes * 60, 0], clamp) : 0;
  const darkHole = hz.type === "dark" ? hz.p : 0;
  const fxK = (fx: string) => {
    const i = spec.shots.findIndex((x) => x.fx === fx);
    return i < 0 ? 0 : smooth(t, [s[i] + 0.3, s[i] + 3.5], [0, 1]);
  };
  const recede = env === "beach" && hz.p <= 0 ? fxK("recede") : 0;

  return (
    <AbsoluteFill style={{ background: C.night }}>
      {/* на обложке сцена ниже - герой не прячется за заголовком */}
      <AbsoluteFill style={{ transform: p.cover ? "translateY(300px)" : undefined }}>
      <World cam={cam} t={t} w={W} h={1920}>
        <Backdrop env={env} time={time} t={t} hz={hz.type === "dark" ? { ...hz, p: Math.max(hz.p, fxK("lights_off")) } : hz} recede={recede} jamT={t} />
        {spec.crowd
          ? Array.from({ length: 7 }).map((_, k) => {
              const cl = typeof spec.crowd === "number" ? s[Math.min(n - 1, spec.crowd)] : ht0 - 2;
              const k2 = smooth(t, [cl, cl + 4], [0, 1]);
              return (
                <Person key={k} x={A.crowd + k * 60 + away * k2 * (300 + k * 70)} y={G} s={0.95} color={["#5DADE2", "#F7DC6F", "#AF7AC5", "#58D68D", "#EC7063", "#F5B041", "#48C9B0"][k]}
                  walk={k2 > 0 && k2 < 1 ? t * 11 + k * 1.3 : 0} run dir={k2 > 0 && k2 < 1 ? away : k % 2 ? 1 : -1} seed={k + 7} wave={k2 <= 0 && k % 3 === 0 ? t * 4 + k : 0} />
              );
            })
          : null}
        <g opacity={1 - hidden}>
          <Person x={hx} y={hy} color={spec.hero.color ?? "#FF8C42"} s={1.15} walk={walking ? t * (running ? 11 : 8) : 0} run={running && walking} dir={dir}
            wave={waving ? t * 6 : 0} seed={4} crouch={crouch} />
        </g>
        <HazardFx hz={hz} t={t} env={env} heroX={hx} />
        {spec.shots.map((sh2, i) => {
          const k = p.cover ? 0 : tagK(i) * (1 - endK); // под финальной заставкой таблички не видны
          if (k <= 0.01) return null;
          const [x, y] = target(sh2, hx, hy);
          return (
            <g key={i}>
              {sh2.tag ? <Tag x={x} y={sh2.icon ? Math.min(y - (sh2.focus === "hero" ? 250 : 300), hy - 300) : y - (sh2.focus === "hero" ? 250 : 300)} text={sh2.tag} color={TAGC[sh2.tagColor ?? "yellow"]} k={k} /> : null}
              {sh2.icon ? <Bubble x={hx + 115} y={hy - 20} icon={sh2.icon} text={sh2.iconText} k={k} /> : null}
            </g>
          );
        })}
      </World>
      </AbsoluteFill>
      {darkHole > 0 ? (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 52%, rgba(0,0,0,0) 0%, rgba(0,0,0,${0.08 * darkHole}) 24%, rgba(0,0,0,${0.5 * darkHole}) 55%)` }} />
      ) : null}
      {/* низ кадра темнее - субтитры читаются даже на снегу и песке */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,10,18,0.45) 0%, rgba(8,10,18,0) 18%, rgba(8,10,18,0) 52%, rgba(8,10,18,0.72) 68%, rgba(8,10,18,0.88) 100%)" }} />
      {!p.cover && tm && t > tStart - 0.3 && t < s[n - 1] && (t < tEnd + 0.4 || tm.after) ? (
        <Timer label={t < tEnd ? tm.label : tm.after ?? tm.label} secs={t < tEnd ? secs : (t - tEnd) * 60} warn={t < tEnd && secs < tm.minutes * 12}
          k={smooth(t, [tStart - 0.3, tStart + 0.2], [0, 1])} />
      ) : null}
      {p.cover ? <CoverText c={p.cover} /> : <HotCaptions words={p.words} hot={spec.hot ?? {}} until={end + 0.3} />}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: p.cover ? 0 : endK, background: `rgba(8,10,18,${0.55 * endK})` }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 116, color: C.white, textAlign: "center", lineHeight: 1.05, marginTop: -260, maxWidth: 940 }}>{spec.ending}</div>
        {spec.endingSub ? (
          <div style={{ marginTop: 40, fontFamily: "Montserrat", fontWeight: 900, fontSize: 46, letterSpacing: 6, color: "#111", background: C.yellow, padding: "14px 40px", borderRadius: 14 }}>
            {spec.endingSub}
          </div>
        ) : null}
      </AbsoluteFill>
      <Audio src={staticFile(`auto/${p.id}/voice.wav`)} />
      {p.music ? <Music src={p.music} /> : null}
      {(p.sfx ?? []).map((x, k) => (
        <Sequence key={`sfx${k}`} from={Math.max(0, f(x.at))} durationInFrames={f(1.3)}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calcScenario = ({ props }: { props: ScenarioProps }) => ({ durationInFrames: Math.ceil(props.total * 30) });
