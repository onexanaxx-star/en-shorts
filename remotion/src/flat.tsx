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

const shade = (hex: string, k: number) => {
  // k<0 - темнее, k>0 - светлее
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const m = c.map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
};
export { shade };

/** Здание с деталями: рамы и подоконники, часть окон со шторами, витрины с навесом, парапет, антенны и кондиционеры. */
export const Building: React.FC<{ x: number; base: number; w: number; floors: number; fh?: number; color?: string; lit?: number; seed?: number; glow?: number }> = ({
  x, base, w, floors, fh = 70, color = C.concrete, lit = 0.35, seed = 1, glow = 0,
}) => {
  const h = floors * fh;
  const cols = Math.max(2, Math.floor(w / 58));
  const cw = (w - 30) / cols;
  const shop = floors >= 3;
  const awn = ["#C0392B", "#2E86AB", "#E1A33B", "#3D9970"][seed % 4];
  return (
    <g>
      {glow > 0 ? <rect x={x - 10} y={base - h - 10} width={w + 20} height={h + 10} fill="none" stroke={C.yellow} strokeWidth={7} opacity={glow} rx={8} /> : null}
      <rect x={x} y={base - h} width={w} height={h} fill={color} />
      <rect x={x + w - 16} y={base - h} width={16} height={h} fill={shade(color, -0.22)} />
      {/* межэтажные пояса */}
      {Array.from({ length: floors }).map((_, f) => (
        <rect key={`b${f}`} x={x} y={base - h + f * fh} width={w} height={5} fill={shade(color, -0.12)} />
      ))}
      {Array.from({ length: shop ? floors - 1 : floors }).map((_, f) =>
        Array.from({ length: cols }).map((__, c) => {
          const r = rnd(seed * 97 + f * 13 + c);
          const on = r < lit;
          const wx = x + 15 + c * cw + 8, wy = base - h + 16 + f * fh, ww = cw - 16, wh = fh - 30;
          return (
            <g key={`${f}-${c}`}>
              <rect x={wx - 3} y={wy - 3} width={ww + 6} height={wh + 6} fill={shade(color, 0.25)} rx={2} />
              <rect x={wx} y={wy} width={ww} height={wh} fill={on ? (r < lit * 0.5 ? "#FFD27A" : C.win) : C.winOff} rx={1} />
              {on && r > lit * 0.7 ? <rect x={wx} y={wy} width={ww * 0.42} height={wh} fill="#E9A15C" opacity={0.9} /> : null}
              {!on ? <path d={`M${wx + 3} ${wy + wh - 4} L${wx + ww * 0.5} ${wy + 3}`} stroke="#4A5570" strokeWidth={3} opacity={0.6} /> : null}
              <rect x={wx - 6} y={wy + wh + 2} width={ww + 12} height={5} fill={shade(color, -0.3)} />
              {rnd(seed * 31 + f * 7 + c) < 0.12 ? <rect x={wx + ww - 22} y={wy + wh + 7} width={24} height={16} fill="#B9BEC8" stroke="#6D7480" strokeWidth={2} /> : null}
            </g>
          );
        }),
      )}
      {shop ? (
        <g>
          <rect x={x + 10} y={base - fh + 18} width={w - 36} height={fh - 18} fill={lit > 0.2 ? "#FFE3A3" : "#2B3243"} opacity={0.9} />
          {Array.from({ length: Math.floor((w - 36) / 40) }).map((_, k) => (
            <rect key={k} x={x + 10 + k * 40} y={base - fh + 6} width={20} height={16} fill={k % 2 ? "#F4F2EE" : awn} />
          ))}
          <path d={`M${x + 4} ${base - fh + 22} L${x + w - 20} ${base - fh + 22} L${x + w - 26} ${base - fh + 6} L${x + 10} ${base - fh + 6} Z`} fill="none" stroke={shade(awn, -0.3)} strokeWidth={3} />
          <rect x={x + w / 2 - 22} y={base - 46} width={30} height={46} fill={shade(color, -0.45)} />
        </g>
      ) : null}
      {/* парапет и крыша */}
      <rect x={x - 6} y={base - h - 12} width={w + 12} height={14} fill={shade(color, -0.3)} />
      {rnd(seed + 5) > 0.4 ? <rect x={x + w * 0.65} y={base - h - 40} width={46} height={28} fill="#A7ADB8" stroke="#6D7480" strokeWidth={3} /> : null}
      {rnd(seed + 9) > 0.5 ? (
        <g>
          <rect x={x + w * 0.2} y={base - h - 90} width={4} height={78} fill="#6D7480" />
          <rect x={x + w * 0.2 - 14} y={base - h - 76} width={32} height={4} fill="#6D7480" />
          <circle cx={x + w * 0.2 + 2} cy={base - h - 92} r={4} fill={C.red} />
        </g>
      ) : null}
    </g>
  );
};

/** Машина: кузов в два тона, стёкла с бликом, колёса с дисками, фары, стоп-сигналы; dir - куда смотрит. */
export const Car: React.FC<{ x: number; y: number; color: string; s?: number; rot?: number; brake?: boolean; dir?: number }> = ({ x, y, color, s = 1, rot = 0, brake, dir = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s * dir} ${s})`}>
    <ellipse cx={0} cy={2} rx={54} ry={6} fill="#000" opacity={0.25} />
    <path d="M-52 -12 Q-52 -30 -40 -32 L-26 -33 L-14 -52 Q-10 -56 -4 -56 L22 -56 Q30 -56 34 -50 L44 -33 L50 -31 Q56 -29 56 -18 L56 -10 Q56 -6 52 -6 L-48 -6 Q-52 -6 -52 -12 Z"
      fill={color} stroke={shade(color, -0.45)} strokeWidth={2.5} />
    <rect x={-52} y={-18} width={108} height={6} fill={shade(color, -0.2)} />
    <path d="M-20 -34 L-10 -50 L4 -50 L4 -34 Z" fill="#2E3B4E" />
    <path d="M8 -34 L8 -50 L22 -50 Q27 -50 30 -46 L38 -34 Z" fill="#2E3B4E" />
    <path d="M-14 -36 L-8 -46 L-4 -46 L-10 -36 Z M12 -36 L14 -46 L17 -46 L15 -36 Z" fill="#9FC3D9" opacity={0.7} />
    <line x1={6} y1={-32} x2={6} y2={-10} stroke={shade(color, -0.35)} strokeWidth={2} />
    <rect x={14} y={-27} width={8} height={3} rx={1} fill={shade(color, -0.4)} />
    <path d="M50 -28 L56 -26 L56 -20 L48 -22 Z" fill="#FFF3B0" />
    <rect x={-53} y={-28} width={6} height={9} rx={2} fill={brake ? "#FF3B30" : "#8E2A2A"} />
    {brake ? <ellipse cx={-60} cy={-24} rx={10} ry={6} fill="#FF3B30" opacity={0.35} /> : null}
    {[-30, 34].map((wx) => (
      <g key={wx}>
        <circle cx={wx} cy={-6} r={12} fill="#15171C" />
        <circle cx={wx} cy={-6} r={6.5} fill="#AEB4BE" />
        <circle cx={wx} cy={-6} r={2.5} fill="#5D6470" />
      </g>
    ))}
  </g>
);

const SKIN = ["#F1C7A3", "#E0AC80", "#C68B59", "#8D5A3B", "#F5D3B8"];
const HAIR = ["#2B1B12", "#5A3A22", "#C9A15B", "#1A1A1A", "#8B3A1E", "#D8D2C4"];
const PANTS = ["#2F3B52", "#3E3E46", "#4A5A3A", "#2B2B33", "#5B4636"];

/** Человечек со «скелетом»: бедро-колено, плечо-локоть, голова с глазом, бровью и причёской.
 *  walk - фаза шага (растёт со временем, 0 - стоит), run - бег (наклон, согнутые руки, широкий шаг), dir - куда смотрит. */
export const Person: React.FC<{ x: number; y: number; color?: string; s?: number; walk?: number; wave?: number; child?: boolean; run?: boolean; dir?: number; seed?: number; crouch?: number }> = ({
  x, y, color = "#FF8C42", s = 1, walk = 0, wave = 0, child, run, dir = 1, seed = 0, crouch = 0,
}) => {
  const moving = walk !== 0;
  const p = walk;
  const A = run ? 42 : 26; // размах ног
  const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed * 3 + 1) % HAIR.length], pants = PANTS[(seed * 7 + 2) % PANTS.length];
  const ink = "#3A4152"; // контур мягче (владелец 19.10.2026: «сильно контурированные»)
  const rad = (d: number) => (d * Math.PI) / 180;
  const bob = moving ? -Math.abs(Math.sin(p)) * (run ? 6 : 3) : 0;
  const lean = run && moving ? 12 : 0;
  const hipY = -52 + bob + crouch * 18, shY = -90 + bob + crouch * 24;
  const leg = (ph: number) => {
    const th = moving ? Math.sin(ph) * A : 0;
    const knee = moving ? 8 + Math.max(0, -Math.cos(ph)) * (run ? 70 : 40) : crouch * 80;
    const kx = Math.sin(rad(th)) * 27, ky = hipY + Math.cos(rad(th)) * 27;
    const sa = th - knee;
    const fx = kx + Math.sin(rad(sa)) * 27, fy = ky + Math.cos(rad(sa)) * 27;
    return { kx, ky, fx, fy: Math.min(fy, 0) };
  };
  const arm = (ph: number, raised = false) => {
    const sh = raised ? -150 + Math.sin(wave) * 25 : moving ? -Math.sin(ph) * (run ? 55 : 30) : 6;
    const el = raised ? -20 : moving ? (run ? 85 : 25) : 10;
    const ex = Math.sin(rad(sh)) * 22, ey = shY + Math.cos(rad(sh)) * 22;
    const ha = sh + el;
    return { ex, ey, hx: ex + Math.sin(rad(ha)) * 20, hy: ey + Math.cos(rad(ha)) * 20 };
  };
  const L1 = leg(p), L2 = leg(p + Math.PI);
  const A1 = arm(p + Math.PI, !!wave), A2 = arm(p);
  const limb = (pts: number[], col: string, w: number) => (
    <>
      <polyline points={pts.join(" ")} fill="none" stroke={ink} strokeWidth={w + 3} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s * dir} ${s})`}>
      <ellipse cx={0} cy={2} rx={22} ry={5} fill="#000" opacity={0.28} />
      <g transform={`rotate(${lean} 0 ${hipY})`}>
        {/* дальние рука и нога - темнее */}
        {limb([0, hipY, L2.kx, L2.ky, L2.fx, L2.fy], shade(pants, -0.25), 10)}
        <ellipse cx={L2.fx + 5} cy={L2.fy - 2} rx={9} ry={5} fill={ink} />
        {limb([0, shY + 4, A2.ex, A2.ey, A2.hx, A2.hy], shade(color, -0.25), 8)}
        {/* туловище */}
        <path d={`M-13 ${shY - 2} Q-15 ${(shY + hipY) / 2} -12 ${hipY + 4} L12 ${hipY + 4} Q15 ${(shY + hipY) / 2} 13 ${shY - 2} Q0 ${shY - 8} -13 ${shY - 2} Z`}
          fill={color} stroke={ink} strokeWidth={2} />
        <path d={`M-12 ${hipY - 2} L12 ${hipY - 2}`} stroke={shade(color, -0.3)} strokeWidth={4} />
        {limb([0, hipY, L1.kx, L1.ky, L1.fx, L1.fy], pants, 10)}
        <ellipse cx={L1.fx + 5} cy={L1.fy - 2} rx={9} ry={5} fill={ink} />
        {/* голова: лицо, глаз, бровь, рот, волосы */}
        <g transform={`translate(0 ${shY - 18})`}>
          <rect x={-4} y={8} width={8} height={8} fill={skin} />
          <circle cx={0} cy={0} r={15} fill={skin} stroke={ink} strokeWidth={2} />
          <path d="M-15 -2 Q-16 -18 0 -18 Q14 -18 15 -6 Q8 -12 -2 -10 Q-8 -4 -15 -2 Z" fill={hair} stroke={ink} strokeWidth={1.8} />
          <ellipse cx={7} cy={-1} rx={2.6} ry={3.4} fill="#1F2430" />
          <circle cx={7.8} cy={-2.2} r={0.9} fill="#fff" />
          <path d="M3 -7 L11 -8" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
          <path d={run || wave ? "M6 7 Q9 9 11 7" : "M6 7 L11 7"} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
          <circle cx={-3} cy={2} r={3.5} fill={shade(skin, -0.15)} />
        </g>
        {limb([0, shY + 4, A1.ex, A1.ey, A1.hx, A1.hy], color, 8)}
        <circle cx={A1.hx} cy={A1.hy} r={5} fill={skin} stroke={ink} strokeWidth={1.5} />
        {child ? (
          <g transform={`translate(-30 ${hipY + 30}) scale(0.55)`}>
            <Person x={0} y={0} color="#7FD1FF" seed={seed + 3} />
          </g>
        ) : null}
      </g>
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
        // гребень цунами: слои воды (тёмная толща, светлая стенка), завиток с тенью, пенный гребень,
        // брызги вперёд, пена у основания и обломки в потоке
        <g>
          {(() => {
            const H = 360, F = front, B = level;
            const sway = Math.sin(t * 3) * 6;
            const body = `M${F - 700},${B} C${F - 420},${B - 30} ${F - 230},${B - H * 0.75} ${F - 40},${B - H + sway}
              C${F + 40},${B - H - 10 + sway} ${F + 95},${B - H * 0.8} ${F + 70},${B - H * 0.55}
              C${F + 40},${B - H * 0.6} ${F + 10},${B - H * 0.5} ${F + 30},${B - H * 0.3}
              C${F + 60},${B - 60} ${F + 80},${B - 10} ${F + 120},${B + 20} L${F + 120},${deep} L${F - 700},${deep} Z`;
            const face = `M${F - 520},${B - 10} C${F - 330},${B - 60} ${F - 190},${B - H * 0.7} ${F - 40},${B - H + 18 + sway}
              C${F + 10},${B - H + 12} ${F + 40},${B - H * 0.75} ${F + 20},${B - H * 0.5}
              C${F - 30},${B - H * 0.35} ${F - 10},${B - 80} ${F + 40},${B} Z`;
            const curl = `M${F + 70},${B - H * 0.55} C${F + 40},${B - H * 0.62} ${F + 8},${B - H * 0.52} ${F + 26},${B - H * 0.32}
              C${F + 40},${B - H * 0.42} ${F + 62},${B - H * 0.45} ${F + 70},${B - H * 0.55} Z`;
            return (
              <>
                <path d={body} fill="#123E5E" />
                <path d={face} fill="#1F6A99" />
                <path d={`M${F - 420},${B - 30} C${F - 280},${B - 90} ${F - 170},${B - H * 0.6} ${F - 60},${B - H * 0.86}`} stroke="#5FB3DD" strokeWidth={10} fill="none" opacity={0.45} strokeLinecap="round" />
                {[0.25, 0.42, 0.6].map((k, i) => (
                  <path key={i} d={`M${F - 520 + k * 300},${B - 20 - k * 60} q${60 + i * 20},${-H * k * 0.5} ${130 + i * 30},${-H * k * 0.9}`} stroke="#A9DCF2" strokeWidth={4} fill="none" opacity={0.35} />
                ))}
                <path d={curl} fill="#0B2B44" />
                {/* пенный гребень */}
                {Array.from({ length: 16 }).map((_, k) => {
                  const u = k / 15;
                  const cx = F - 260 + u * 330 + Math.sin(t * 5 + k) * 4;
                  const cy = B - H * (0.62 + 0.38 * Math.sin(u * Math.PI * 0.92)) + sway + Math.cos(t * 4 + k) * 3;
                  return <circle key={k} cx={cx} cy={cy} r={12 + rnd(k + 3) * 14} fill="#EAF7FD" opacity={0.92} />;
                })}
                {/* брызги летят вперёд */}
                {Array.from({ length: 26 }).map((_, k) => {
                  const ph = (t * 1.6 + rnd(k)) % 1;
                  const x = F + 40 + ph * (120 + rnd(k + 5) * 160);
                  const y = B - H + 20 - Math.sin(ph * Math.PI) * (60 + rnd(k + 9) * 70) + ph * 140;
                  return <circle key={`s${k}`} cx={x} cy={y} r={3 + rnd(k + 2) * 6} fill="#EAF7FD" opacity={0.85 * (1 - ph)} />;
                })}
                {/* пена и обломки у основания */}
                {Array.from({ length: 14 }).map((_, k) => (
                  <ellipse key={`f${k}`} cx={F - 30 + rnd(k + 30) * 170 + Math.sin(t * 6 + k) * 6} cy={B - 6 - rnd(k + 40) * 26} rx={18 + rnd(k) * 22} ry={8 + rnd(k + 1) * 8} fill="#DDF1FA" opacity={0.85} />
                ))}
                {Array.from({ length: 5 }).map((_, k) => (
                  <rect key={`d${k}`} x={F - 120 - k * 70 + Math.sin(t * 2 + k) * 10} y={B - H * (0.35 + 0.1 * k) + Math.cos(t * 3 + k) * 6} width={34 + k * 6} height={8}
                    fill={["#7A5A3C", "#8A93A3", "#E63946", "#6B4A2B", "#F1FAEE"][k]} transform={`rotate(${(t * 90 + k * 50) % 360} ${F - 100 - k * 70} ${B - H * (0.35 + 0.1 * k)})`} />
                ))}
              </>
            );
          })()}
        </g>
      ) : (
        // после волны: пятна пены и рябь на поверхности
        <g opacity={0.8}>
          {Array.from({ length: 22 }).map((_, k) => (
            <ellipse key={k} cx={-1500 + ((rnd(k) * 5600 + t * 30) % 5600)} cy={level + 10 + rnd(k + 7) * 30} rx={26 + rnd(k + 3) * 40} ry={5} fill="#BFE6F5" opacity={0.35} />
          ))}
        </g>
      )}
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
