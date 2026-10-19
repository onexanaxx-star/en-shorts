// 3D-реконструкция «Gimli Glider» (проба 19.10.2026): Three.js внутри Remotion. Стилизованный «как в игре» мир:
// низкополигональный самолёт, облака, поля, озеро Виннипег, полоса с гоночными машинами. Камера меняет ракурс по фразам.
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Music } from "./AutoInfo";
import { Captions, clamp, setAccent, Word } from "./infokit";
import "./fonts";

const ACC = "#FF9F43";
const RED = "#FF4D4D";
const WHITE = "#F6F2EA";
const ease = Easing.bezier(0.45, 0, 0.25, 1);

export type ReconProps = {
  id: string;
  total: number;
  segments: { text: string; start: number; end: number }[];
  words: Word[];
  music?: string;
  sfx?: { s: string; at: number; v: number }[];
};

// ---------- полёт: где самолёт в момент t ----------
const SPEED = 42; // единиц в секунду (самолёт длиной ~40)
export const CRUISE = 300; // высота 41 000 футов в единицах сцены

export type Plan = { s: number[]; tTD: number; tStop: number; xTD: number };

export const planOf = (segs: { start: number }[], total: number): Plan => {
  const s = segs.map((x) => x.start);
  const tTD = s[7] + 0.6; // касание полосы - в начале фразы про переднюю стойку
  const tStop = tTD + 4.5;
  return { s: [...s, total], tTD, tStop, xTD: SPEED * tTD };
};

export const xAt = (t: number, p: Plan) => {
  if (t <= p.tTD) return SPEED * t;
  const u = Math.min(t, p.tStop) - p.tTD; // тормозим до остановки (равнозамедленно)
  const dur = p.tStop - p.tTD;
  return p.xTD + SPEED * (u - (u * u) / (2 * dur));
};

/** Плавная кривая через опорные точки (монотонный кубический сплайн): без изломов скорости - картинка не дёргается. */
export const smooth = (t: number, ts: number[], vs: number[]) => {
  if (t <= ts[0]) return vs[0];
  const n = ts.length;
  if (t >= ts[n - 1]) return vs[n - 1];
  const d = ts.slice(1).map((x, i) => (vs[i + 1] - vs[i]) / (x - ts[i]));
  const m = ts.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    return d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  });
  m[0] = 0;
  m[n - 1] = 0;
  let i = 0;
  while (t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i];
  const u = (t - ts[i]) / h;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return h00 * vs[i] + h10 * h * m[i] + h01 * vs[i + 1] + h11 * h * m[i + 1];
};

export const altAt = (t: number, p: Plan) => {
  const g = p.s[1] + 1.5;
  const sl = p.s[6];
  // круиз -> плавное планирование -> скольжение (круче) -> выравнивание -> касание
  return smooth(t, [0, g, (g + sl) / 2, sl, p.tTD - 1.6, p.tTD - 0.4, p.tTD], [CRUISE, CRUISE, 175, 70, 14, 3.4, 2.6]);
};

export const enginesOn = (t: number, p: Plan) => interpolate(t, [p.s[1] + 0.8, p.s[1] + 2.2], [1, 0], clamp);

// ---------- модель самолёта из простых фигур ----------
const Plane: React.FC<{ engines: number; rat: number; ratSpin: number }> = ({ engines, rat, ratSpin }) => {
  const white = "#EDEAE4";
  const grey = "#8E949C";
  return (
    <group>
      {/* фюзеляж вдоль оси X, нос в +X */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[2.6, 2.6, 34, 14]} />
        <meshStandardMaterial color={white} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[19.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[2.6, 5, 14]} />
        <meshStandardMaterial color={white} flatShading />
      </mesh>
      <mesh position={[-20.5, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[2.6, 7, 14]} />
        <meshStandardMaterial color={white} flatShading />
      </mesh>
      {/* окна кабины и полоса окон */}
      <mesh position={[18.2, 1.0, 0]}>
        <boxGeometry args={[2.2, 0.8, 4.4]} />
        <meshStandardMaterial color="#1B2230" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[30, 0.45, 5.25]} />
        <meshStandardMaterial color="#2A3242" />
      </mesh>
      {/* полоса цвета канала */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[34, 0.5, 5.27]} />
        <meshStandardMaterial color={ACC} />
      </mesh>
      {/* крылья (стреловидные) */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, -1.2, side * 11]} rotation={[0, side * 0.42, 0]}>
            <boxGeometry args={[7, 0.6, 22]} />
            <meshStandardMaterial color={grey} flatShading />
          </mesh>
          {/* двигатель */}
          <group position={[3.5, -3.3, side * 8.5]}>
            <mesh rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[1.5, 1.3, 6, 12]} />
              <meshStandardMaterial color={white} flatShading />
            </mesh>
            {/* выхлоп: светится, пока двигатели работают */}
            <mesh position={[-3.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[1.0, 2.4 + 2 * engines, 10]} />
              <meshBasicMaterial color="#FFB46B" transparent opacity={0.85 * engines} />
            </mesh>
          </group>
          {/* стабилизатор */}
          <mesh position={[-21, 1.2, side * 4.2]} rotation={[0, side * 0.35, 0]}>
            <boxGeometry args={[3.6, 0.35, 8]} />
            <meshStandardMaterial color={grey} flatShading />
          </mesh>
        </group>
      ))}
      {/* киль */}
      <mesh position={[-21, 5, 0]} rotation={[0, 0, -0.45]}>
        <boxGeometry args={[5, 8, 0.4]} />
        <meshStandardMaterial color={ACC} flatShading />
      </mesh>
      {/* аварийная турбина (RAT) выезжает снизу и крутится */}
      <group position={[6, -2.6 - 2.4 * rat, 2.4]} scale={rat * 1.6}>
        <mesh>
          <boxGeometry args={[0.3, 2.2, 0.3]} />
          <meshStandardMaterial color={grey} />
        </mesh>
        <group position={[0.4, -1.1, 0]} rotation={[ratSpin, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.15, 2.4, 0.3]} />
            <meshStandardMaterial color="#FFD166" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.15, 2.4, 0.3]} />
            <meshStandardMaterial color="#FFD166" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// ---------- мир ----------
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const Ground: React.FC<{ xTD: number }> = ({ xTD }) => {
  // лоскуты полей: одна геометрия, цвет на каждый квадрат
  const geo = useMemo(() => {
    const size = 60;
    const x0 = -600, x1 = xTD + 1400, z0 = -1400, z1 = 700;
    const pos: number[] = [];
    const col: number[] = [];
    const pal = ["#2F3B26", "#3A4A2B", "#4A4A2E", "#33402A", "#524A33", "#28331F"].map((c) => new THREE.Color(c));
    let i = 0;
    for (let x = x0; x < x1; x += size) {
      for (let z = z0; z < z1; z += size) {
        i++;
        if (z < -380 && x > xTD - 900) continue; // тут озеро
        const c = pal[Math.floor(rnd(i) * pal.length)];
        const a = [x, 0, z], b = [x + size, 0, z], d = [x, 0, z + size], e = [x + size, 0, z + size];
        for (const v of [a, d, b, b, d, e]) {
          pos.push(...v);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, [xTD]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      {/* озеро Виннипег рядом с базой */}
      <mesh position={[xTD + 250, -0.3, -1000]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2400, 1240]} />
        <meshStandardMaterial color="#1E3A52" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* деревья-конусы вдоль полей */}
      {Array.from({ length: 160 }).map((_, k) => {
        const x = -400 + rnd(k + 5) * (xTD + 1500);
        const z = 60 + rnd(k + 900) * 600;
        if (Math.abs(x - xTD - 200) < 500 && z < 140) return null;
        return (
          <mesh key={k} position={[x, 9, rnd(k + 77) > 0.5 ? z : -z * 0.5 - 60]}>
            <coneGeometry args={[6, 18, 6]} />
            <meshStandardMaterial color="#1F2B1A" flatShading />
          </mesh>
        );
      })}
    </group>
  );
};

const Runway: React.FC<{ xTD: number }> = ({ xTD }) => {
  const x0 = xTD - 120;
  const len = 700;
  const carCols = ["#E63946", "#F1FAEE", "#FFB703", "#219EBC", "#8338EC", "#FB8500"];
  return (
    <group>
      <mesh position={[x0 + len / 2, 0.15, 0]}>
        <boxGeometry args={[len, 0.3, 64]} />
        <meshStandardMaterial color="#3B3D42" roughness={0.9} />
      </mesh>
      {/* разметка */}
      {Array.from({ length: 22 }).map((_, k) => (
        <mesh key={k} position={[x0 + 20 + k * 31, 0.32, 0]}>
          <boxGeometry args={[14, 0.05, 1.6]} />
          <meshBasicMaterial color="#D9D6CF" />
        </mesh>
      ))}
      {/* гоночная полоса посередине старой базы: машины и кемперы у края и в дальнем конце */}
      {Array.from({ length: 26 }).map((_, k) => {
        const far = k < 8;
        const x = far ? x0 + len - 60 + (k % 4) * 9 : x0 + 80 + k * 22;
        const z = far ? -6 + Math.floor(k / 4) * 12 : (k % 2 ? 1 : -1) * (38 + rnd(k) * 10);
        const camper = !far && k % 5 === 0;
        return (
          <mesh key={k} position={[x, camper ? 2.2 : 1.2, z]}>
            <boxGeometry args={camper ? [9, 4.4, 4] : [5, 1.8, 2.6]} />
            <meshStandardMaterial color={camper ? "#D8D2C4" : carCols[k % carCols.length]} flatShading />
          </mesh>
        );
      })}
    </group>
  );
};

const Clouds: React.FC<{ xTD: number }> = ({ xTD }) => {
  const items = useMemo(
    () =>
      Array.from({ length: 140 }).map((_, k) => ({
        x: -300 + rnd(k + 11) * (xTD * 0.7 + 500),
        y: 210 + rnd(k + 31) * 30,
        z: -500 + rnd(k + 51) * 900,
        r: 18 + rnd(k + 71) * 26,
      })),
    [xTD],
  );
  return (
    <group>
      {items.map((c, k) => (
        <mesh key={k} position={[c.x, c.y, c.z]} scale={[1.6, 0.55, 1.1]}>
          <icosahedronGeometry args={[c.r, 1]} />
          <meshStandardMaterial color="#F4F2F0" emissive="#5A5F78" emissiveIntensity={0.35} flatShading transparent opacity={0.88} />
        </mesh>
      ))}
    </group>
  );
};

// искры под носом после складывания передней стойки
const Sparks: React.FC<{ t: number; p: Plan }> = ({ t, p }) => {
  const t0 = p.tTD + 0.9;
  if (t < t0 || t > p.tStop + 0.3) return null;
  const nx = xAt(t, p) + 17;
  return (
    <group>
      {Array.from({ length: 40 }).map((_, k) => {
        const age = ((t - t0) * 3 + rnd(k)) % 1;
        return (
          <mesh key={k} position={[nx - age * 22 - rnd(k + 3) * 4, 0.6 + age * 3 * rnd(k + 9), (rnd(k + 5) - 0.5) * 6 * (1 + age)]}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color={k % 3 ? "#FFB347" : "#FFF3B0"} transparent opacity={1 - age} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- камера ----------
type Shot = { off: [number, number, number]; look?: (t: number, px: number, py: number) => [number, number, number] };

const CameraRig: React.FC<{ t: number; p: Plan; px: number; py: number }> = ({ t, p, px, py }) => {
  const { camera } = useThree();
  const s = p.s;
  const runway = (): [number, number, number] => [p.xTD + 150, 0, 0];
  const shots: { at: number; shot: Shot }[] = [
    { at: 0, shot: { off: [-70, 22, 48] } }, // крейсер: сзади-сбоку
    { at: s[1], shot: { off: [-52, 6, 52], look: (t, px, py) => [px + 3, py - 3, 8.5] } }, // двигатели
    { at: s[2], shot: { off: [-20, 30, 120] } }, // общий план сбоку (панель с топливом)
    { at: s[3], shot: { off: [22, -16, 30], look: (t, px, py) => [px + 6, py - 5, 2.4] } }, // снизу - видно аварийную турбину
    { at: s[4], shot: { off: [-110, 90, -10] } }, // высоко сзади - поворот к Гимли
    { at: s[5], shot: { off: [-75, 24, -6], look: () => runway() } }, // за самолётом - впереди видна полоса с машинами
    { at: s[6], shot: { off: [70, 8, 60] } }, // спереди-сбоку: самолёт боком (скольжение)
    { at: s[7], shot: { off: [45, 5, 42] } }, // посадка, низко
    { at: s[8], shot: { off: [0, 0, 0] } }, // финал - облёт (ниже)
  ];
  let k = 0;
  while (k + 1 < shots.length && t >= shots[k + 1].at) k++;
  const cur = shots[k];
  const prev = shots[Math.max(0, k - 1)];
  const blend = k === 0 ? 1 : interpolate(t, [cur.at - 0.1, cur.at + 0.9], [0, 1], { ...clamp, easing: ease });
  const off = (sh: Shot, idx: number): [number, number, number] => {
    if (idx === shots.length - 1) {
      const a = (t - shots[idx].at) * 0.35 + 0.6;
      return [Math.cos(a) * 75, 26, Math.sin(a) * 75];
    }
    return sh.off;
  };
  const o1 = off(prev.shot, Math.max(0, k - 1));
  const o2 = off(cur.shot, k);
  const o = o1.map((v, i) => v + (o2[i] - v) * blend);
  const target = (sh: Shot): [number, number, number] => (sh.look ? sh.look(t, px, py) : [px, py, 0]);
  const l1 = target(prev.shot), l2 = target(cur.shot);
  const l = l1.map((v, i) => v + (l2[i] - v) * blend);
  // лёгкое «дыхание» камеры - чтобы кадр жил
  const sway = Math.sin(t * 0.7) * 1.5;
  camera.position.set(px + o[0], Math.max(4, py + o[1] + sway * 0.5), o[2] + sway);
  camera.lookAt(l[0], l[1], l[2]);
  return null;
};

// ---------- 2D-слои поверх 3D ----------
export const HUD: React.FC<{ alt: number; warn: boolean; t: number }> = ({ alt, warn, t }) => {
  const ft = Math.max(0, Math.round((((alt - 2.6) / (CRUISE - 2.6)) * 41000) / 10) * 10);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 120, right: 70, textAlign: "right", fontFamily: "Oswald", color: WHITE, textShadow: "0 4px 18px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 30, letterSpacing: 6, color: ACC, fontFamily: "Montserrat", fontWeight: 800 }}>ALTITUDE</div>
        <div style={{ fontSize: 84, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{ft.toLocaleString("en-US")}</div>
        <div style={{ fontSize: 28, letterSpacing: 6, fontFamily: "Montserrat", fontWeight: 700, color: "rgba(246,242,234,0.7)" }}>FEET</div>
      </div>
      <div style={{ position: "absolute", top: 120, left: 70, fontFamily: "Montserrat", fontWeight: 800, fontSize: 30, letterSpacing: 6, color: ACC,
        border: `2px solid ${ACC}`, borderRadius: 40, padding: "8px 26px", background: "rgba(10,9,8,0.45)" }}>
        FLIGHT 143
      </div>
      {warn ? (
        <div style={{ position: "absolute", top: 300, left: 0, width: 1080, display: "flex", justifyContent: "center", gap: 24,
          opacity: 0.7 + 0.3 * Math.cos(t * Math.PI * 2 * 1.1) }}>
          {["L ENG", "R ENG", "FUEL"].map((x) => (
            <div key={x} style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 52, color: "#fff", background: RED, padding: "6px 26px", borderRadius: 10 }}>{x}</div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Panel: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 300 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const k = Math.min(interpolate(frame, [0, 0.4 * fps], [0, 1], clamp), interpolate(frame, [durationInFrames - 0.4 * fps, durationInFrames], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ top, alignItems: "center", opacity: k, translate: `0px ${(1 - k) * 30}px` }}>
      <div style={{ background: "rgba(12,14,18,0.78)", border: "2px solid rgba(255,159,67,0.5)", borderRadius: 28, padding: "34px 44px", width: 860 }}>{children}</div>
    </AbsoluteFill>
  );
};

export const FuelPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const need = interpolate(frame, [0.3 * fps, 1.2 * fps], [0, 1], { ...clamp, easing: ease });
  const had = interpolate(frame, [1.2 * fps, 2.2 * fps], [0, 0.45], { ...clamp, easing: ease });
  const row = (label: string, val: string, w: number, c: string) => (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Montserrat", fontWeight: 700, fontSize: 34, color: WHITE }}>
        <span>{label}</span><span style={{ color: c }}>{val}</span>
      </div>
      <div style={{ height: 34, borderRadius: 17, background: "rgba(255,255,255,0.08)", marginTop: 10 }}>
        <div style={{ height: 34, borderRadius: 17, width: `${w * 100}%`, background: c }} />
      </div>
    </div>
  );
  return (
    <Panel>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 64, color: WHITE, textAlign: "center" }}>
        POUNDS <span style={{ color: RED }}>≠</span> KILOGRAMS
      </div>
      {row("FUEL NEEDED", "22,300 kg", need, ACC)}
      {row("FUEL ON BOARD", "≈10,100 kg", had, RED)}
    </Panel>
  );
};

export const MapPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d1 = interpolate(frame, [0.3 * fps, 1.6 * fps], [0, 1], { ...clamp, easing: ease });
  const cross = interpolate(frame, [1.4 * fps, 1.9 * fps], [0, 1], clamp);
  const d2 = interpolate(frame, [2.0 * fps, 3.6 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <Panel>
      <svg width={772} height={520} viewBox="0 0 772 520">
        {/* озеро Виннипег - условно */}
        <path d="M470 40 C560 60 600 160 560 260 C530 340 600 420 540 500 L700 500 L700 40 Z" fill="#1E3A52" opacity={0.9} />
        <text x={610} y={150} fill="rgba(246,242,234,0.5)" fontFamily="Montserrat" fontWeight={700} fontSize={20}>LAKE WINNIPEG</text>
        {/* самолёт, курс на Виннипег (зачёркнут) и поворот к Гимли */}
        <circle cx={90} cy={110} r={12} fill={ACC} />
        <text x={50} y={80} fill={WHITE} fontFamily="Montserrat" fontWeight={800} fontSize={24}>FLIGHT 143</text>
        <path d="M90 110 L430 440" stroke="rgba(246,242,234,0.55)" strokeWidth={6} strokeDasharray="14 12" pathLength={1}
          style={{ strokeDasharray: `${d1} 1` } as React.CSSProperties} fill="none" />
        <circle cx={440} cy={450} r={12} fill="none" stroke={WHITE} strokeWidth={4} />
        <text x={330} y={500} fill={WHITE} fontFamily="Montserrat" fontWeight={800} fontSize={26}>WINNIPEG</text>
        <g opacity={cross}>
          <line x1={410} y1={420} x2={470} y2={480} stroke={RED} strokeWidth={8} />
          <line x1={470} y1={420} x2={410} y2={480} stroke={RED} strokeWidth={8} />
          <text x={480} y={420} fill={RED} fontFamily="Oswald" fontWeight={700} fontSize={34}>TOO FAR</text>
        </g>
        <path d="M90 110 C220 160 330 200 420 210" stroke={ACC} strokeWidth={8} pathLength={1} strokeDasharray={`${d2} 1`} fill="none" strokeLinecap="round" />
        <g opacity={d2 > 0.95 ? 1 : 0}>
          <circle cx={430} cy={212} r={16} fill={ACC} />
          <text x={300} y={262} fill={ACC} fontFamily="Oswald" fontWeight={700} fontSize={44}>GIMLI</text>
        </g>
      </svg>
    </Panel>
  );
};

export const EndTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0.2 * fps, 1.0 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ top: 330, alignItems: "center", opacity: k }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 34, letterSpacing: 10, color: ACC }}>69 OF 69 SURVIVED</div>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 130, color: WHITE, textShadow: "0 8px 40px rgba(0,0,0,0.8)", marginTop: 10 }}>THE GIMLI GLIDER</div>
    </AbsoluteFill>
  );
};

// ---------- сцена целиком ----------
const World: React.FC<{ t: number; p: Plan }> = ({ t, p }) => {
  const px = xAt(t, p);
  const py = altAt(t, p);
  const s = p.s;
  // крен при повороте к Гимли, скольжение (рыскание + крен), опускание носа после поломки стойки
  const bank = interpolate(t, [s[4] + 0.5, s[4] + 2, s[5] - 1, s[5]], [0, -0.45, -0.45, 0], clamp);
  const slip = interpolate(t, [s[6] + 0.3, s[6] + 1.5, p.tTD - 1.2, p.tTD - 0.3], [0, 1, 1, 0], clamp);
  const glidePitch = interpolate(t, [s[1] + 1.5, s[1] + 3], [0, -0.05], clamp);
  const noseDown = interpolate(t, [p.tTD + 0.7, p.tTD + 1.1], [0, -0.07], clamp);
  const flare = interpolate(t, [p.tTD - 1.2, p.tTD - 0.2, p.tTD + 0.4], [0, 0.09, 0.02], clamp);
  const rat = interpolate(t, [s[3] + 1.2, s[3] + 2.2], [0, 1], clamp);
  const sky = Math.min(1, py / CRUISE);
  return (
    <>
      <fog attach="fog" args={[new THREE.Color().lerpColors(new THREE.Color("#3A3148"), new THREE.Color("#5A4A5E"), sky), 300, 2600]} />
      <hemisphereLight args={["#FFD7B0", "#2A2E3A", 0.9]} />
      <directionalLight position={[-400, 300, 200]} intensity={2.2} color="#FFC08A" />
      <Ground xTD={p.xTD} />
      <Runway xTD={p.xTD} />
      <Clouds xTD={p.xTD} />
      <Sparks t={t} p={p} />
      <group position={[px, py, 0]} rotation={[bank - slip * 0.35, slip * 0.5, glidePitch + noseDown + flare]}>
        <Plane engines={enginesOn(t, p)} rat={rat} ratSpin={t * 18} />
      </group>
      <CameraRig t={t} p={p} px={px} py={py} />
    </>
  );
};

export const GimliRecon: React.FC<ReconProps> = (props) => {
  setAccent(ACC, "en");
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = planOf(props.segments, props.total);
  const s = p.s;
  const f = (x: number) => Math.round(x * fps);
  const alt = altAt(t, p);
  const sky = Math.min(1, alt / CRUISE);
  const cta = props.segments[props.segments.length - 1].end + 0.2;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${sky > 0.5 ? "#1B1630" : "#2A2236"} 0%, #6B4A5E 55%, #E0895A 100%)` }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 52, near: 1, far: 5000, position: [-70, 320, 48] }} gl={{ alpha: true }}>
        <World t={t} p={p} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,8,12,0.55) 0%, rgba(8,8,12,0) 22%, rgba(8,8,12,0) 62%, rgba(8,8,12,0.75) 100%)" }} />
      <HUD alt={alt} warn={t > s[1] + 0.5 && t < s[2] + 0.5} t={t} />
      <Sequence from={f(s[2] + 0.2)} durationInFrames={f(s[3] - s[2] - 0.1)}>
        <FuelPanel />
      </Sequence>
      <Sequence from={f(s[4] + 0.2)} durationInFrames={f(s[5] - s[4] - 0.1)}>
        <MapPanel />
      </Sequence>
      <Sequence from={f(s[8])}>
        <EndTitle />
      </Sequence>
      <Captions words={props.words} until={cta + 3} />
      <Audio src={staticFile(`auto/${props.id}/voice.wav`)} />
      {props.music ? <Music src={props.music} /> : null}
      {(props.sfx ?? []).map((x, k) => (
        <Sequence key={`sfx${k}`} from={Math.max(0, f(x.at))} durationInFrames={f(1.3)}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calcRecon = ({ props }: { props: ReconProps }) => ({ durationInFrames: Math.ceil(props.total * 30) });
