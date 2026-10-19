// Проба английского канала: сценарий выживания «Tsunami on the beach» в плоской 2D-анимации (как вирусный ролик
// с краном): камера с наездами, таймер до волны, нумерованные шаги, обрыв на интриге («Part 2 tomorrow»).
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Music } from "./AutoInfo";
import { Building, C, Car, HotCaptions, Person, rnd, Siren, Stars, Tag, Timer, Water, World } from "./flat";
import { smooth } from "./GimliRecon";
import { clamp, Word } from "./infokit";

export type SurvProps = {
  id: string;
  total: number;
  segments: { text: string; start: number; end: number }[];
  words: Word[];
  music?: string;
  sfx?: { s: string; at: number; v: number }[];
};

const W = 3600, GROUND = 1500;
const HOTEL = { x: 2350, w: 420, floors: 10, fh: 70 };
const ROOF = GROUND - HOTEL.floors * HOTEL.fh;
const HOT: Record<string, string> = {
  tsunami: C.red, car: C.red, jam: C.red, traffic: C.red, stuck: C.red, up: C.yellow, mia: C.yellow, twenty: C.yellow,
  minutes: C.yellow, back: C.red, close: C.red, tallest: C.yellow, concrete: C.yellow, fourth: C.yellow, floor: C.yellow,
  top: C.yellow, biggest: C.red, hours: C.red, problem: C.red, child: C.red, two: C.yellow, ten: C.yellow, one: C.yellow, three: C.yellow,
};
const CARS = ["#E63946", "#F1FAEE", "#FFB703", "#219EBC", "#8338EC", "#FB8500", "#2A9D8F", "#E9C46A", "#6D597A", "#F4A261", "#90BE6D"];

const ease01 = (t: number, a: number, b: number) => smooth(t, [a, b], [0, 1]);

export const Tsunami: React.FC<SurvProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = [...p.segments.map((x) => x.start), p.total];
  const f = (x: number) => Math.round(x * fps);
  const end = p.segments[p.segments.length - 1].end;

  // вода: море у берега -> отступает -> волна заливает всё -> уровень держится
  const recede = ease01(t, s[5] + 0.3, s[5] + 3.5);
  const flood = ease01(t, s[9], s[9] + 2.6);
  const front = 900 - 480 * recede + (W + 400 - 420) * flood;
  const level = GROUND - 20 - 210 * ease01(t, s[9] + 0.5, s[9] + 4) + 14 * recede * (1 - flood);

  // Миа: на пляже -> идёт к отелю -> поднимается на крышу
  const walkK = ease01(t, s[7] - 0.3, s[8]);
  const climbK = ease01(t, s[8], s[9] - 0.2);
  const miaX = climbK > 0 ? 2440 + Math.sin(climbK * Math.PI * 10) * 40 + (climbK > 0.97 ? (climbK - 0.97) * 3000 : 0) : 1180 + (2440 - 1180) * walkK;
  const miaY = GROUND - (GROUND - ROOF) * climbK;
  const walking = (walkK > 0 && walkK < 1) || (climbK > 0 && climbK < 1);

  const g = (z: number) => GROUND - 260 / z; // горизонт на ~60% высоты кадра
  const cam = [
    { t: 0, x: 1060, y: g(1.6), z: 1.6 },
    { t: s[1] - 0.5, x: 1110, y: GROUND - 230, z: 2.1 },
    { t: s[1] + 0.8, x: 1450, y: g(1.45), z: 1.45 },
    { t: s[2], x: 1780, y: g(1.35), z: 1.35 },
    { t: s[3] - 0.2, x: 1900, y: g(1.55), z: 1.55 },
    { t: s[3] + 1.0, x: 2560, y: GROUND - 360, z: 1.2 },
    { t: s[4] - 0.2, x: 2560, y: ROOF + 160, z: 1.3 },
    { t: s[4] + 0.8, x: 1180, y: GROUND - 140, z: 2.7 },
    { t: s[5] + 0.4, x: 640, y: g(1.15), z: 1.15 },
    { t: s[6] - 0.3, x: 700, y: g(1.2), z: 1.2 },
    { t: s[6] + 0.6, x: 2560, y: GROUND - 360, z: 1.2 },
    { t: s[7] + 0.5, x: 1850, y: g(1.25), z: 1.25 },
    { t: s[8] - 0.2, x: 2440, y: GROUND - 170, z: 2.0 },
    { t: s[8] + 2, x: 2560, y: GROUND - 360, z: 1.25 },
    { t: s[9] - 0.3, x: 2540, y: ROOF + 60, z: 1.9 },
    { t: s[9] + 0.4, x: 1650, y: GROUND - 300, z: 1.05 },
    { t: s[9] + 2.2, x: 2150, y: GROUND - 320, z: 1.0 },
    { t: s[10], x: 2150, y: GROUND - 320, z: 1.05 },
    { t: s[10] + 1.2, x: 2540, y: ROOF + 70, z: 2.1 },
    { t: s[11] + 2, x: 2540, y: ROOF + 70, z: 2.4 },
    { t: s[12] + 0.3, x: 2350, y: (ROOF + GROUND) / 2 + 40, z: 1.4 },
    { t: s[13], x: 2350, y: (ROOF + GROUND) / 2 + 40, z: 1.5 },
    { t: p.total, x: 2350, y: (ROOF + GROUND) / 2 + 40, z: 1.56 },
  ];

  const tag = (a: number, b: number) => Math.min(ease01(t, a, a + 0.4), 1 - ease01(t, b - 0.3, b));
  const timerSecs = interpolate(t, [s[4] + 0.6, s[9]], [20 * 60, 0], clamp);
  const sirenOn = t < s[4] ? 1 : 0;
  const manK = ease01(t, s[12], s[12] + 0.6);
  const endK = ease01(t, s[13] - 0.2, s[13] + 0.6);

  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World cam={cam} t={t} w={W} h={1920}>
        <Stars w={W} />
        <circle cx={600} cy={420} r={70} fill="#E8E4D8" opacity={0.85} />
        {/* дальний город */}
        {Array.from({ length: 14 }).map((_, k) => (
          <rect key={k} x={1300 + k * 170} y={GROUND - 260 - rnd(k) * 380} width={150} height={600} fill="#161C2C" />
        ))}
        {/* пляж и дорога */}
        <path d={`M700 ${GROUND + 6} L1260 ${GROUND - 4} L1260 2400 L700 2400 Z`} fill={C.sand} />
        <rect x={1260} y={GROUND} width={W} height={900} fill={C.ground} />
        <rect x={1260} y={GROUND - 6} width={W} height={10} fill="#2C3344" />
        {Array.from({ length: 30 }).map((_, k) => (
          <rect key={k} x={1280 + k * 80} y={GROUND + 28} width={40} height={5} fill="#5B6274" />
        ))}
        {/* дома и отель */}
        <Building x={1900} base={GROUND} w={260} floors={3} seed={3} color="#6E7686" />
        <Building x={2900} base={GROUND} w={300} floors={4} seed={5} color="#6E7686" />
        <Building x={3250} base={GROUND} w={260} floors={2} seed={7} color="#6E7686" />
        <Building x={HOTEL.x} base={GROUND} w={HOTEL.w} floors={HOTEL.floors} fh={HOTEL.fh} seed={9} lit={0.5} glow={tag(s[6] + 0.3, s[9])} />
        <rect x={HOTEL.x + 250} y={ROOF - 64} width={150} height={56} rx={6} fill="#22293A" stroke={C.yellow} strokeWidth={3} />
        <rect x={HOTEL.x + 270} y={ROOF - 8} width={8} height={8} fill="#22293A" />
        <rect x={HOTEL.x + 372} y={ROOF - 8} width={8} height={8} fill="#22293A" />
        <text x={HOTEL.x + 325} y={ROOF - 24} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={34} fill={C.yellow}>
          HOTEL
        </text>
        <Siren x={1100} y={GROUND} t={t} on={sirenOn} />
        {/* машины: пробка, после волны - всплывают и качаются */}
        {CARS.map((col, k) => {
          const x0 = 1330 + k * 92 + (t < s[9] ? Math.min(t, s[3]) * 2 : 0);
          const fl = ease01(t, s[9] + 0.6 + k * 0.05, s[9] + 2.5);
          const y = GROUND - 2 - fl * (GROUND - level - 4) + fl * Math.sin(t * 1.5 + k) * 6;
          return <Car key={k} x={x0 + fl * (40 + rnd(k) * 120)} y={y} color={col} s={0.95} rot={fl * Math.sin(t + k * 2) * 9} brake={t < s[9]} />;
        })}
        {/* люди у пробки бегут к машинам */}
        {Array.from({ length: 6 }).map((_, k) => {
          const k2 = ease01(t, s[1] - 0.6, s[1] + 2.5);
          return (
            <Person key={k} x={900 + k * 50 + k2 * (450 + k * 60)} y={GROUND} color={["#5DADE2", "#F7DC6F", "#AF7AC5", "#58D68D", "#EC7063", "#F5B041"][k]} s={0.8}
              walk={k2 > 0 && k2 < 1 ? t * 10 + k : 0} />
          );
        })}
        {/* морское дно: мокрый песок, видно при отливе */}
        <path d={`M-2000 ${GROUND + 420} L300 ${GROUND + 90} L700 ${GROUND + 14} L1260 ${GROUND + 4} L1260 2600 L-2000 2600 Z`} fill="#7C6A48" />
        {Array.from({ length: 9 }).map((_, k) => (
          <ellipse key={k} cx={380 + k * 45} cy={GROUND + 70 - k * 7} rx={14} ry={4} fill="#5E5038" opacity={0.7} />
        ))}
        <Water level={level} front={front} t={t} w={W} crest={flood > 0 && flood < 0.98} />
        <rect x={1260} y={GROUND + 8} width={W} height={900} fill={C.ground} />
        <path d={`M700 ${GROUND + 14} L1260 ${GROUND + 4} L1260 2400 L700 2400 Z`} fill={C.sand} />
        {/* Миа */}
        <Person x={miaX} y={miaY} color="#FF8C42" s={1.05} walk={walking ? t * 9 : 0} wave={0} />
        {/* мужчина с ребёнком на крыше машины */}
        <g opacity={manK}>
          <Car x={2150} y={level + 18} color="#E63946" s={1.3} rot={Math.sin(t * 1.3) * 4} />
          <Person x={2150} y={level - 34} color="#4FC3F7" s={1.3} wave={t * 6} child />
        </g>
        {/* таблички */}
        <Tag x={1700} y={GROUND - 210} text="1 ROAD OUT" color={C.red} k={tag(s[1] + 1.0, s[3])} />
        <Tag x={2000} y={GROUND - 330} text="JAPAN 2011 · 1 IN 3 STUCK" color={C.yellow} k={tag(s[2] + 0.3, s[3] + 0.2)} size={30} />
        <Tag x={2560} y={ROOF - 110} text="GO UP, NOT FAR" color={C.green} k={tag(s[3] + 1.2, s[4])} />
        <Tag x={1180} y={GROUND - 170} text="MIA" color={C.yellow} k={tag(s[4] + 0.6, s[5])} />
        <Tag x={790} y={GROUND - 230} text="WATER PULLS BACK = RUN" color={C.red} k={tag(s[5] + 1.5, s[6] + 0.3)} />
        <Tag x={2560} y={GROUND - 4 * HOTEL.fh - 30} text="4TH FLOOR +" color={C.green} k={tag(s[6] + 1.0, s[8])} />
        <Tag x={2560} y={ROOF - 110} text="10 FLOORS · CONCRETE" color={C.yellow} k={tag(s[7] + 0.4, s[8] + 0.5)} />
        <Tag x={2400} y={ROOF - 210} text="STAY UP" color={C.green} k={tag(s[10] + 0.8, s[12])} />
        <Tag x={1700} y={level - 160} text="WAVE 2 · WAVE 3 ..." color={C.red} k={tag(s[10] + 0.2, s[11] + 0.5)} />
      </World>
      {/* затемнение по краям и снизу под субтитры */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,10,18,0.45) 0%, rgba(8,10,18,0) 18%, rgba(8,10,18,0) 62%, rgba(8,10,18,0.8) 100%)" }} />
      {t > s[4] + 0.4 && t < s[11] ? (
        <Timer label={t < s[9] ? "WAVE ARRIVES IN" : "ON THE ROOF"} secs={t < s[9] ? timerSecs : (t - s[9]) * 75} warn={t < s[9] && timerSecs < 5 * 60} k={ease01(t, s[4] + 0.4, s[4] + 0.9)} />
      ) : null}
      <HotCaptions words={p.words} hot={HOT} until={end + 0.3} />
      {/* финал: «Part 2» */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: endK, background: `rgba(8,10,18,${0.55 * endK})` }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 120, color: C.white, textAlign: "center", lineHeight: 1.05, marginTop: -260 }}>
          WHAT WOULD
          <br />
          YOU DO?
        </div>
        <div style={{ marginTop: 40, fontFamily: "Montserrat", fontWeight: 900, fontSize: 46, letterSpacing: 6, color: "#111", background: C.yellow, padding: "14px 40px", borderRadius: 14 }}>
          PART 2 TOMORROW
        </div>
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

export const calcSurv = ({ props }: { props: SurvProps }) => ({ durationInFrames: Math.ceil(props.total * 30) });
