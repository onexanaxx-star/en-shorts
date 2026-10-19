// Анимации для новых ниш (пробы второго аккаунта, 19.10.2026): шкала глубины/высоты и таймлайн по годам.
// Безопасная зона та же: x 60..1020, y 300..1300.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, GOLD, RED, WHITE } from "./infokit";
import "./fonts";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.45, 0, 0.25, 1);
const DIM = "rgba(246,242,234,0.35)";
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/** Шкала глубины или высоты: число плавно идёт от from к to, маркер едет по линейке, метки загораются, когда их проходят. */
export const Meter: React.FC<{ from: number; to: number; unit?: string; label?: string; marks?: { v: number; text: string; bad?: boolean }[]; dur: number }> = ({
  from, to, unit = "", label, marks = [], dur,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = interpolate(t, [0.3, Math.max(1.2, dur - 0.6)], [0, 1], { ...clamp, easing: inOut });
  const v = from + (to - from) * p;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const TOP = 380, H = 820, X = 250;
  // глубина: from сверху (0), to снизу; высота (from > to): from сверху тоже - едем вниз
  const y = (val: number) => TOP + (H * Math.abs(val - from)) / Math.max(1, hi - lo);
  const k = interpolate(t, [0, 0.4], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ opacity: k }}>
      {label ? <div style={{ position: "absolute", top: 300, left: 0, width: 1080, textAlign: "center", fontFamily: "Montserrat", fontWeight: 700,
        fontSize: 34, letterSpacing: 8, color: DIM }}>{label}</div> : null}
      <div style={{ position: "absolute", left: X, top: TOP, width: 4, height: H, background: "rgba(246,242,234,0.18)" }} />
      <div style={{ position: "absolute", left: X, top: TOP, width: 4, height: y(v) - TOP, background: GOLD, boxShadow: `0 0 18px ${GOLD}` }} />
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: X - (i % 5 === 0 ? 26 : 14), top: TOP + (H * i) / 10, width: i % 5 === 0 ? 26 : 14, height: 3, background: DIM }} />
      ))}
      {marks.map((m, i) => {
        const passed = (to > from ? v >= m.v : v <= m.v);
        const s = spring({ frame: passed ? frame : 0, fps, config: { damping: 22, stiffness: 120 } });
        const c = m.bad ? RED : GOLD;
        return (
          <div key={i} style={{ position: "absolute", left: X + 40, top: y(m.v) - 26, display: "flex", alignItems: "center", gap: 18,
            opacity: passed ? 1 : 0.28 }}>
            <div style={{ width: 40, height: 3, background: passed ? c : DIM }} />
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 44, color: passed ? WHITE : DIM, scale: passed ? interpolate(s, [0, 1], [1.08, 1]) : 1 }}>
              {m.text}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: X - 14, top: y(v) - 14, width: 32, height: 32, borderRadius: 16, background: GOLD, boxShadow: `0 0 30px ${GOLD}` }} />
      <div style={{ position: "absolute", right: 70, top: Math.min(y(v) - 70, TOP + H - 150), textAlign: "right" }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 120, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums",
          textShadow: "0 8px 30px rgba(0,0,0,0.7)" }}>{fmt(v)}</div>
        <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 34, letterSpacing: 6, color: GOLD }}>{unit}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Таймлайн: годы сверху вниз, линия дорастает до каждого события, последнее - крупно (или красным, если это падение). */
export const Timeline: React.FC<{ items: { year: string; text: string; bad?: boolean }[]; dur: number }> = ({ items, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const n = items.length;
  const gap = Math.min(220, 820 / Math.max(1, n - 1));
  const TOP = 380, X = 200;
  const at = (i: number) => 0.25 + (i * Math.max(0.8, dur - 1.0)) / n;
  const grow = interpolate(t, [at(0), at(n - 1)], [0, (n - 1) * gap], { ...clamp, easing: inOut });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: X, top: TOP + 30, width: 4, height: grow, background: GOLD }} />
      {items.map((it, i) => {
        const s = spring({ frame: frame - at(i) * fps, fps, config: { damping: 22, stiffness: 120 } });
        const last = i === n - 1;
        const c = it.bad ? RED : GOLD;
        return (
          <div key={i} style={{ position: "absolute", left: X - 22, top: TOP + i * gap, display: "flex", alignItems: "center", gap: 36,
            opacity: s, translate: `${(1 - s) * 40}px 0px` }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: last ? c : "#0A0908", border: `5px solid ${c}`, boxShadow: last ? `0 0 30px ${c}` : "none" }} />
            <div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: last ? 92 : 72, color: c, lineHeight: 1 }}>{it.year}</div>
              <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: last ? 40 : 34, color: WHITE, maxWidth: 680, marginTop: 6 }}>{it.text}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
