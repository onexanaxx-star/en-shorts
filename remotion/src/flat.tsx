// Набор плоской 2D-анимации для английского канала (сценарии выживания, 19.10.2026): мир в своих координатах,
// камера с плавными наездами, здания, машины, люди, вода, сирена, таблички, таймер, субтитры с цветными словами.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { smooth } from "./GimliRecon";
import "./fonts";

export const C = {
  night: "#0F1424",
  sky2: "#1C2540",
  ground: "#1A1F2B",
  sand: "#C9B07A",
  sea: "#1F5F8B",
  seaDark: "#174A6E",
  foam: "#D9EEF7",
  concrete: "#8A93A3",
  concreteDark: "#5D6574",
  win: "#F2C14E",
  winOff: "#2B3243",
  red: "#FF4D4D",
  yellow: "#FFC83D",
  green: "#3DDC84",
  white: "#F4F2EE",
};

export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Камера: опорные точки {t, x, y, z} - центр кадра в координатах мира и зум; между ними плавно. */
export type Cam = { t: number; x: number; y: number; z: number }[];
export const World: React.FC<{ cam: Cam; t: number; w: number; h: number; children: React.ReactNode }> = ({ cam, t, w, h, children }) => {
  const ts = cam.map((c) => c.t);
  const x = smooth(t, ts, cam.map((c) => c.x));
  const y = smooth(t, ts, cam.map((c) => c.y));
  const z = smooth(t, ts, cam.map((c) => c.z));
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <g transform={`translate(540 960) scale(${z}) translate(${-x} ${-y})`}>
          <rect x={-2000} y={-2000} width={w + 4000} height={h + 4000} fill={C.night} />
          {children}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const Stars: React.FC<{ w: number; n?: number }> = ({ w, n = 120 }) => (
  <g>
    {Array.from({ length: n }).map((_, k) => (
      <circle key={k} cx={rnd(k) * w} cy={rnd(k + 300) * 900} r={1 + rnd(k + 600) * 2} fill="#fff" opacity={0.25 + rnd(k + 900) * 0.4} />
    ))}
  </g>
);

/** Здание: этажи с окнами (часть горит), опционально обводка-подсветка. */
export const Building: React.FC<{ x: number; base: number; w: number; floors: number; fh?: number; color?: string; lit?: number; seed?: number; glow?: number }> = ({
  x, base, w, floors, fh = 70, color = C.concrete, lit = 0.35, seed = 1, glow = 0,
}) => {
  const h = floors * fh;
  const cols = Math.max(2, Math.floor(w / 46));
  return (
    <g>
      {glow > 0 ? <rect x={x - 8} y={base - h - 8} width={w + 16} height={h + 8} fill="none" stroke={C.yellow} strokeWidth={6} opacity={glow} rx={6} /> : null}
      <rect x={x} y={base - h} width={w} height={h} fill={color} />
      <rect x={x} y={base - h} width={w} height={10} fill={C.concreteDark} />
      {Array.from({ length: floors }).map((_, f) =>
        Array.from({ length: cols }).map((__, c) => {
          const on = rnd(seed * 97 + f * 13 + c) < lit;
          return (
            <rect key={`${f}-${c}`} x={x + 14 + c * ((w - 28) / cols)} y={base - h + 22 + f * fh} width={(w - 28) / cols - 12} height={fh - 34}
              fill={on ? C.win : C.winOff} opacity={on ? 0.85 : 1} rx={3} />
          );
        }),
      )}
    </g>
  );
};

export const Car: React.FC<{ x: number; y: number; color: string; s?: number; rot?: number; brake?: boolean }> = ({ x, y, color, s = 1, rot = 0, brake }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <rect x={-46} y={-30} width={92} height={24} rx={8} fill={color} />
    <path d="M-28 -30 L-18 -48 L20 -48 L32 -30 Z" fill={color} />
    <path d="M-22 -32 L-15 -45 L-2 -45 L-2 -32 Z M2 -32 L2 -45 L17 -45 L26 -32 Z" fill="#9FC3D9" opacity={0.85} />
    <circle cx={-26} cy={-6} r={10} fill="#111" />
    <circle cx={26} cy={-6} r={10} fill="#111" />
    {brake ? <rect x={-48} y={-26} width={6} height={8} fill={C.red} /> : null}
  </g>
);

/** Человечек: голова, тело, ноги; walk - фаза ходьбы, wave - машет рукой. */
export const Person: React.FC<{ x: number; y: number; color?: string; s?: number; walk?: number; wave?: number; child?: boolean }> = ({
  x, y, color = "#FF8C42", s = 1, walk = 0, wave = 0, child,
}) => {
  const lg = Math.sin(walk) * 14;
  const arm = wave ? -120 + Math.sin(wave) * 25 : Math.sin(walk + Math.PI) * 18;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1={0} y1={-34} x2={-lg * 0.6} y2={0} stroke="#2A2F3A" strokeWidth={9} strokeLinecap="round" />
      <line x1={0} y1={-34} x2={lg * 0.6} y2={0} stroke="#2A2F3A" strokeWidth={9} strokeLinecap="round" />
      <rect x={-13} y={-78} width={26} height={46} rx={10} fill={color} />
      <line x1={8} y1={-70} x2={8 + 30 * Math.cos((arm * Math.PI) / 180)} y2={-70 + 30 * Math.sin((arm * Math.PI) / 180)} stroke={color} strokeWidth={8} strokeLinecap="round" />
      <circle cx={0} cy={-92} r={13} fill="#F1C7A3" />
      {child ? (
        <g transform="translate(-22 -58) scale(0.55)">
          <rect x={-13} y={-78} width={26} height={46} rx={10} fill="#7FD1FF" />
          <circle cx={0} cy={-92} r={13} fill="#F1C7A3" />
        </g>
      ) : null}
    </g>
  );
};

/** Сирена на столбе: звуковые дуги пульсируют. */
export const Siren: React.FC<{ x: number; y: number; t: number; on: number }> = ({ x, y, t, on }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-5} y={-260} width={10} height={260} fill="#4A5163" />
    <rect x={-26} y={-290} width={52} height={36} rx={6} fill="#C9CED8" />
    <circle cx={0} cy={-272} r={10} fill={on > 0.5 && Math.floor(t * 4) % 2 ? C.red : "#6B2A2A"} />
    {[0, 1, 2].map((k) => {
      const ph = (t * 1.4 + k / 3) % 1;
      return (
        <g key={k} opacity={on * (1 - ph)}>
          <path d={`M${40 + ph * 120} -330 Q${70 + ph * 160} -272 ${40 + ph * 120} -214`} stroke={C.red} strokeWidth={6} fill="none" />
          <path d={`M${-40 - ph * 120} -330 Q${-70 - ph * 160} -272 ${-40 - ph * 120} -214`} stroke={C.red} strokeWidth={6} fill="none" />
        </g>
      );
    })}
  </g>
);

/** Табличка-пилюля над объектом (в координатах мира). */
export const Tag: React.FC<{ x: number; y: number; text: string; color?: string; k?: number; size?: number }> = ({ x, y, text, color = C.yellow, k = 1, size = 34 }) => {
  const w = text.length * size * 0.62 + 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * k})`} opacity={k}>
      <rect x={-w / 2} y={-size} width={w} height={size * 1.6} rx={size * 0.5} fill={color} />
      <text x={0} y={size * 0.28} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill={color === C.yellow || color === C.green ? "#111" : "#fff"}>
        {text}
      </text>
    </g>
  );
};

/** Вода: море со скруглённой волной; level - уровень поверхности (y), front - докуда дошла вода по x. */
export const Water: React.FC<{ level: number; front: number; t: number; w: number; deep?: number; crest?: boolean }> = ({ level, front, t, deep = 2400, crest }) => {
  const pts: string[] = [];
  for (let x = -2000; x <= front; x += 40) {
    pts.push(`${x},${level + Math.sin(x * 0.012 + t * 2.2) * 9 + Math.sin(x * 0.031 - t * 3) * 4}`);
  }
  const d = `M-2000,${deep} L${pts.join(" L")} L${front},${deep} Z`;
  return (
    <g>
      <path d={d} fill={C.sea} opacity={0.94} />
      <path d={`M${pts.join(" L")}`} stroke={C.foam} strokeWidth={6} fill="none" opacity={0.8} />
      {crest ? (
        // гребень волны на фронте: вода нависает и закручивается, пена по краю
        <g>
          <path d={`M${front - 420},${level} C${front - 250},${level - 40} ${front - 120},${level - 210} ${front + 10},${level - 170}
            C${front + 70},${level - 150} ${front + 40},${level - 90} ${front - 10},${level - 100}
            C${front + 30},${level - 40} ${front + 60},${level} ${front + 90},${deep} L${front - 420},${deep} Z`} fill={C.seaDark} />
          <path d={`M${front - 300},${level - 30} C${front - 180},${level - 120} ${front - 80},${level - 205} ${front + 10},${level - 170}
            C${front + 70},${level - 150} ${front + 40},${level - 90} ${front - 10},${level - 100}`} stroke={C.foam} strokeWidth={10} fill="none" strokeLinecap="round" />
          {Array.from({ length: 14 }).map((_, k) => (
            <circle key={k} cx={front - 20 + rnd(k) * 120} cy={level - 60 - rnd(k + 20) * 140 + Math.sin(t * 6 + k) * 8} r={6 + rnd(k + 40) * 12} fill={C.foam} opacity={0.75} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

/** Таймер сверху экрана (не в мире). */
export const Timer: React.FC<{ label: string; secs: number; warn?: boolean; k?: number }> = ({ label, secs, warn, k = 1 }) => {
  const m = Math.floor(Math.max(0, secs) / 60), s = Math.floor(Math.max(0, secs) % 60);
  return (
    <AbsoluteFill style={{ top: 150, alignItems: "center", opacity: k }}>
      <div style={{ border: `4px solid ${warn ? C.red : C.green}`, borderRadius: 18, padding: "10px 34px", background: "rgba(10,12,20,0.75)", textAlign: "center" }}>
        <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 26, letterSpacing: 6, color: warn ? C.red : C.green }}>{label}</div>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 92, color: warn ? C.red : C.white, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Субтитры как в вирусных роликах: короткая фраза, слова появляются под голос, ключевые слова - красным/жёлтым. */
export const HotCaptions: React.FC<{ words: [string, number, number][]; hot: Record<string, string>; until: number }> = ({ words, hot, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups = React.useMemo(() => {
    const g: number[][] = [];
    let cur: number[] = [];
    words.forEach(([w], i) => {
      cur.push(i);
      if (cur.length === 3 || /[.!?,:;]$/.test(w)) {
        g.push(cur);
        cur = [];
      }
    });
    if (cur.length) g.push(cur);
    return g;
  }, [words]);
  if (t > until) return null;
  const gi = groups.findIndex((g, k) => t >= words[g[0]][1] - 0.05 && (!groups[k + 1] || t < words[groups[k + 1][0]][1] - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  return (
    <AbsoluteFill style={{ top: 1380, alignItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 960, gap: "0 20px" }}>
        {g.map((i) => {
          const [w, a] = words[i];
          const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          const said = t >= a - 0.03;
          const pop = interpolate(t, [a - 0.03, a + 0.12], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 76, textTransform: "uppercase", display: "inline-block",
              color: said ? hot[key] ?? C.white : "rgba(244,242,238,0.35)", scale: said ? pop : 1,
              textShadow: "0 5px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.8)" }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
