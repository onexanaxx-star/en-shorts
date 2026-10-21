// Набор для стиля «Инфографика»: фон-видео + золотая сетка, спокойные субтитры (как в A), счётчики,
// сравнение полосками с зачёркиванием, линейный график, круговая диаграмма, тающая полоска, плитки.
import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "./fonts";

export let GOLD = "#E2BE6E"; // акцент; для других ниш меняется через setAccent (бирюза - океан, голубой - авиация...)
export let LANG = "ru"; // язык надписей в шаблоне
/** Прозрачный вариант акцента (вместо зашитого золота rgba(226,190,110,a)). */
export const tint = (a: number) => {
  const h = GOLD.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};
export const setAccent = (c?: string, lang?: string) => {
  GOLD = c || "#E2BE6E";
  LANG = lang || "ru";
};
export const RED = "#D8453B";
export const WHITE = "#F6F2EA";
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export type Word = [string, number, number];
export type Data = { segments: { text: string; start: number; end: number }[]; words: Word[]; total: number };
const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Фон: видео (приглушено), золотая сетка медленно плывёт, виньетка, сверху/снизу затемнение. */
export const InfoBG: React.FC<{ id: string }> = ({ id }) => {
  return (
    <AbsoluteFill style={{ background: "#0A0908" }}>
      <Video
        src={staticFile(`${id}/bg.mp4`)}
        muted
        objectFit="cover"
        style={{ width: "100%", height: "100%", filter: "brightness(0.3) saturate(0.6) contrast(1.05) blur(3px)", scale: 1.04 }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,9,8,0.9) 0%, rgba(10,9,8,0.1) 22%, rgba(10,9,8,0.1) 62%, rgba(10,9,8,0.92) 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

export const Header: React.FC<{ tag: string }> = ({ tag }) => {
  return (
    <>
      <AbsoluteFill style={{ top: 120, alignItems: "center" }}>
        <div
          style={{
            fontFamily: "Montserrat",
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: 8,
            color: GOLD,
            border: `2px solid ${GOLD}`,
            borderRadius: 40,
            padding: "10px 32px",
            background: "rgba(10,9,8,0.5)",
          }}
        >
          {tag}
        </div>
      </AbsoluteFill>
    </>
  );
};

/** Субтитры как в A: фраза стоит на месте (появляется мягким подъёмом), слова плавно загораются золотом. */
export const Captions: React.FC<{ words: Word[]; until: number; top?: number; maxWidth?: number }> = ({ words, until, top = 1420, maxWidth = 940 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const phrases = React.useMemo(() => {
    const g: number[][] = [];
    let cur: number[] = [];
    words.forEach(([w], i) => {
      cur.push(i);
      if (cur.length === 4 || /[.!?:»]$/.test(w)) {
        g.push(cur);
        cur = [];
      }
    });
    if (cur.length) g.push(cur);
    return g;
  }, [words]);
  if (t > until) return null;
  const pi = phrases.findIndex((p, k) => t >= words[p[0]][1] - 0.08 && (!phrases[k + 1] || t < words[phrases[k + 1][0]][1] - 0.08));
  if (pi < 0) return null;
  const p = phrases[pi];
  const st = words[p[0]][1] - 0.08;
  const k = interpolate(t, [st, st + 0.18], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ top, height: 260, alignItems: "center", opacity: k, translate: `0px ${(1 - k) * 22}px` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth }}>
        {p.map((i) => {
          const [w, a] = words[i];
          const now = t >= a && t < (words[i + 1]?.[1] ?? a + 0.6);
          const lit = interpolate(t, [a - 0.02, a + 0.1], [0, 1], clamp);
          // «прыгающее» появление ровно в момент слова: место под слово занято заранее - строка не сдвигается
          const pop = spring({ frame: frame - Math.round(a * fps), fps, config: { damping: 14, stiffness: 260, mass: 0.6 } });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: t < a - 0.02 ? 0.3 : 1, // несказанное - бледно: строка всегда ровная, без пустот
                scale: t < a - 0.02 ? 1 : interpolate(pop, [0, 1], [0.82, 1]),
                margin: "0 12px",
                fontFamily: "Montserrat",
                fontWeight: 800,
                fontSize: 64,
                textTransform: "uppercase",
                color: interpolateColors(lit, [0, 1], ["rgba(246,242,234,0.55)", now ? GOLD : WHITE]),
                textShadow: "0 4px 18px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Title: React.FC<{ text: string; top?: number; size?: number; color?: string }> = ({ text, top = 330, size = 104, color = WHITE }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.35 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ top, alignItems: "center" }}>
      <div
        style={{
          fontFamily: "Oswald",
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.05,
          color,
          textAlign: "center",
          maxWidth: 960,
          opacity: k,
          translate: `0px ${(1 - k) * 40}px`,
          textShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const BigCounter: React.FC<{ to: number; prefix?: string; suffix?: string; label?: string; top?: number; color?: string }> = ({
  to,
  prefix = "",
  suffix = "",
  label,
  top = 330,
  color = GOLD,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 22, stiffness: 120 } });
  // дробные числа (0.01 мегапикселя) показываем с теми же знаками после точки, а не округляем до 0
  const dec = Math.min(2, (String(to).split(".")[1] ?? "").length);
  const n = interpolate(frame, [0, 0.8 * fps], [0, to], { ...clamp, easing: Easing.out(Easing.cubic) }).toFixed(dec);
  return (
    <AbsoluteFill style={{ top, alignItems: "center" }}>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 300, lineHeight: 1, color, scale: interpolate(pop, [0, 1], [0.4, 1]), opacity: pop, textShadow: `0 10px 70px ${color}55` }}>
        {prefix}
        {n}
        {suffix}
      </div>
      {label ? (
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 80, color: WHITE, opacity: interpolate(frame, [0.4 * fps, 0.7 * fps], [0, 1], clamp) }}>
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Сравнение полосками: подпись + полоска растёт; strike - подпись зачёркивается красным. */
export const Bars: React.FC<{ title: string; items: { label: string; w: number; color: string; strike?: boolean; at: number }[] }> = ({ title, items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ padding: "330px 100px 0" }}>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 82, color: WHITE, lineHeight: 1.05, opacity: interpolate(frame, [0, 8], [0, 1], clamp) }}>{title}</div>
      {items.map((it, k) => (
        <div key={k} style={{ marginTop: 56, opacity: interpolate(frame, [it.at * fps, (it.at + 0.25) * fps], [0, 1], clamp) }}>
          <div style={{ position: "relative", display: "inline-block", fontFamily: "Montserrat", fontWeight: 700, fontSize: 50, color: WHITE }}>
            {it.label}
            {it.strike ? (
              <div style={{ position: "absolute", left: -8, top: "52%", height: 9, borderRadius: 4, background: RED, width: interpolate(frame, [(it.at + 0.7) * fps, (it.at + 1.0) * fps], [0, 100], clamp) + "%" }} />
            ) : null}
          </div>
          <div
            style={{
              marginTop: 14,
              height: 72,
              borderRadius: 16,
              background: it.color,
              boxShadow: it.color === GOLD ? `0 0 40px ${GOLD}66` : "none",
              width: interpolate(frame, [it.at * fps, (it.at + 0.8) * fps], [0, it.w], { ...clamp, easing: Easing.out(Easing.cubic) }),
            }}
          />
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** Линейный график, который рисуется слева направо. pts - точки 0..1; marks - подписи на точках. */
export const LineChart: React.FC<{
  pts: [number, number][];
  drawTo: { at: number; upto: number }[]; // к моменту at (сек от начала сцены) нарисовано upto точек
  marks: { i: number; text: string; color: string; at: number }[];
  hot?: number; // с какой точки линия становится золотой и толстой
}> = ({ pts, drawTo, marks, hot = 999 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const W = 820;
  const H = 620;
  const X = (x: number) => 130 + x * W;
  const Y = (y: number) => 420 + (1 - y) * H;
  const times = [0, ...drawTo.map((d) => d.at)];
  const counts = [1, ...drawTo.map((d) => d.upto)];
  const shown = interpolate(t, times, counts, { ...clamp, easing: Easing.inOut(Easing.quad) });
  const full = Math.floor(shown);
  const frac = shown - full;
  const path: [number, number][] = pts.slice(0, Math.max(1, full));
  if (full < pts.length && full >= 1) {
    const [x0, y0] = pts[full - 1];
    const [x1, y1] = pts[full];
    path.push([x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac]);
  }
  const toD = (arr: [number, number][]) => arr.map(([x, y], k) => `${k ? "L" : "M"}${X(x)},${Y(y)}`).join(" ");
  const cold = path.slice(0, Math.min(path.length, hot + 1));
  const warm = path.length > hot ? path.slice(hot) : [];
  const tip = path[path.length - 1];
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(0)} stroke="rgba(246,242,234,0.25)" strokeWidth={3} />
        <path d={toD(cold)} fill="none" stroke={WHITE} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
        {warm.length > 1 ? (
          <path d={toD(warm)} fill="none" stroke={GOLD} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 18px ${GOLD})` }} />
        ) : null}
        {tip ? <circle cx={X(tip[0])} cy={Y(tip[1])} r={16} fill={path.length > hot ? GOLD : WHITE} /> : null}
      </svg>
      {marks.map((m, k) => {
        const s = spring({ frame: frame - m.at * fps, fps, config: { damping: 22, stiffness: 120 } });
        const [x, y] = pts[m.i];
        return (
          <div key={k} style={{ position: "absolute", left: Math.min(Math.max(X(x) - 210, 40), 1080 - 40 - 420), top: Y(y) - 120, width: 420, textAlign: "center", opacity: s, scale: interpolate(s, [0, 1], [0.6, 1]) }}>
            <div style={{ display: "inline-block", fontFamily: "Oswald", fontWeight: 700, fontSize: 52, color: "#111", background: m.color, borderRadius: 12, padding: "2px 18px" }}>{m.text}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Круговая диаграмма: сегменты появляются по очереди; red - «утечка» (пульсирует). */
export const Donut: React.FC<{ segs: { label: string; v: number; color: string; at: number; pulse?: boolean }[]; center?: string; centerAt?: number }> = ({
  segs,
  center,
  centerAt = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const R = 230;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const total = segs.reduce((a, s) => a + s.v, 0);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <circle cx={540} cy={720} r={R} fill="none" stroke="rgba(246,242,234,0.08)" strokeWidth={90} />
        {segs.map((s, k) => {
          const len = (s.v / total) * C;
          const grow = interpolate(t, [s.at, s.at + 0.5], [0, 1], { ...clamp, easing: ease });
          const off = acc;
          acc += len;
          const pulse = s.pulse ? 1 + 0.06 * Math.sin(frame / 4) * interpolate(t, [s.at + 0.5, s.at + 0.8], [0, 1], clamp) : 1;
          return (
            <circle
              key={k}
              cx={540}
              cy={720}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={90 * pulse}
              strokeDasharray={`${Math.max(0.01, len * grow - 6)} ${C}`}
              strokeDashoffset={-off}
              transform="rotate(-90 540 720)"
            />
          );
        })}
      </svg>
      {center ? (
        <div style={{ position: "absolute", top: 650, width: "100%", textAlign: "center", fontFamily: "Oswald", fontWeight: 700, fontSize: 110, color: RED, opacity: interpolate(t, [centerAt, centerAt + 0.3], [0, 1], clamp) }}>
          {center}
        </div>
      ) : null}
      <div style={{ position: "absolute", top: 1030, left: 110, right: 110, display: "flex", flexWrap: "wrap", gap: "14px 34px", justifyContent: "center" }}>
        {segs.map((s, k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, opacity: interpolate(t, [s.at, s.at + 0.3], [0, 1], clamp) }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: s.color }} />
            <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 38, color: WHITE }}>{s.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Тающая полоска: 100% -> почти 0 за сцену, с подписью «день 1 -> день 14». */
export const Drain: React.FC<{ label: string; dur: number }> = ({ label, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const k = interpolate(t, [0.5, dur - 0.3], [1, 0.04], { ...clamp, easing: Easing.in(Easing.quad) });
  const day = Math.round(interpolate(t, [0.5, dur - 0.3], [1, 14], clamp));
  return (
    <AbsoluteFill style={{ padding: "380px 100px 0" }}>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 90, color: WHITE }}>{label}</div>
      <div style={{ marginTop: 40, height: 110, borderRadius: 22, background: "rgba(246,242,234,0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${k * 100}%`, background: interpolateColors(k, [0, 0.4, 1], [RED, GOLD, GOLD]), borderRadius: 22 }} />
      </div>
      <div style={{ marginTop: 26, fontFamily: "Montserrat", fontWeight: 700, fontSize: 52, color: k < 0.3 ? RED : GOLD }}>{LANG === "en" ? "DAY" : "ДЕНЬ"} {day}</div>
    </AbsoluteFill>
  );
};

/** Плитки, которые выпрыгивают по одной (например, «3 акции»). */
export const Tiles: React.FC<{ n: number; label: string; top?: number }> = ({ n, label, top = 760 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ top, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 30 }}>
        {new Array(n).fill(0).map((_, k) => {
          const s = spring({ frame: frame - k * 5, fps, config: { damping: 22, stiffness: 120 } });
          return (
            <div key={k} style={{ width: 200, height: 250, borderRadius: 24, border: `4px solid ${GOLD}`, background: tint(0.12), display: "flex", alignItems: "center", justifyContent: "center", scale: interpolate(s, [0, 1], [0.3, 1]), opacity: s }}>
              <svg width={120} height={120} viewBox="0 0 24 24">
                <path d="M3 17l6-6 4 4 8-8" fill="none" stroke={GOLD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 34, fontFamily: "Montserrat", fontWeight: 700, fontSize: 48, color: WHITE, opacity: interpolate(frame, [0.4 * fps, 0.7 * fps], [0, 1], clamp) }}>{label}</div>
    </AbsoluteFill>
  );
};

export const Cta: React.FC<{ big: string; small?: string; where?: string }> = ({ big, small = "бесплатно в Telegram", where = "ссылка в профиле" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(10,9,8,0.85)" }}>
      <div style={{ textAlign: "center", scale: interpolate(s, [0, 1], [0.85, 1]), opacity: s }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 92, color: WHITE, lineHeight: 1.1, maxWidth: 900 }}>{big}</div>
        <div style={{ margin: "40px auto 0", width: 660, padding: "26px 0", borderRadius: 60, background: GOLD, fontFamily: "Montserrat", fontWeight: 800, fontSize: 44, color: "#111" }}>
          {small.toUpperCase()}
        </div>
        <div style={{ marginTop: 26, fontFamily: "Montserrat", fontWeight: 600, fontSize: 36, color: "rgba(255,255,255,0.7)" }}>{where}</div>
      </div>
    </AbsoluteFill>
  );
};


/** Путь по ступеням: узлы появляются по очереди и соединяются линией (например, фабрика -> телеграф -> сталь). */
export const Steps: React.FC<{ steps: { label: string; at: number; gold?: boolean }[]; top?: number }> = ({ steps, top = 520 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // точки с отступом от краёв, подписи не упираются в край экрана
  const x = (k: number) => 220 + (k * 640) / Math.max(1, steps.length - 1);
  const lw = steps.length >= 4 ? 210 : 280;
  const fs = steps.length >= 4 ? 42 : 50;
  return (
    <AbsoluteFill>
      {steps.slice(1).map((s, k) => (
        <div key={k} style={{ position: "absolute", top: top + 37, left: x(k), height: 6, background: GOLD,
          width: (x(k + 1) - x(k)) * interpolate(t, [s.at - 0.4, s.at], [0, 1], { ...clamp, easing: ease }) }} />
      ))}
      {steps.map((s, k) => {
        const p = spring({ frame: frame - s.at * fps, fps, config: { damping: 22, stiffness: 120 } });
        return (
          <div key={k} style={{ position: "absolute", top, left: x(k) - 40, opacity: p, scale: interpolate(p, [0, 1], [0.4, 1]) }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: s.gold ? GOLD : WHITE, boxShadow: s.gold ? `0 0 40px ${GOLD}` : "none" }} />
            <div style={{ position: "absolute", top: 110, left: 40 - lw / 2, width: lw, textAlign: "center", fontFamily: "Oswald", fontWeight: 700, fontSize: fs, color: s.gold ? GOLD : WHITE }}>
              {s.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Попытки: карточки с номером; провал - красный крест и подпись, успех - золотая галочка. */
export const Attempts: React.FC<{ items: { title: string; note: string; ok: boolean; at: number }[]; top?: number }> = ({ items, top = 420 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ top, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 28 }}>
        {items.map((it, k) => {
          const p = spring({ frame: frame - it.at * fps, fps, config: { damping: 22, stiffness: 120 } });
          const mark = spring({ frame: frame - (it.at + 0.45) * fps, fps, config: { damping: 22, stiffness: 120 } });
          const col = it.ok ? GOLD : RED;
          return (
            <div key={k} style={{ width: 290, height: 400, borderRadius: 28, border: `4px solid ${it.ok ? GOLD : "rgba(246,242,234,0.35)"}`,
              background: it.ok ? tint(0.14) : "rgba(10,9,8,0.55)", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", opacity: p, scale: interpolate(p, [0, 1], [0.5, 1]) }}>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 64, color: WHITE }}>{it.title}</div>
              <div style={{ fontSize: 150, lineHeight: 1.1, color: col, fontFamily: "Montserrat", fontWeight: 800, scale: interpolate(mark, [0, 1], [2, 1]), opacity: mark }}>
                {it.ok ? "✓" : "✕"}
              </div>
              <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 34, color: col, opacity: mark }}>{it.note}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
