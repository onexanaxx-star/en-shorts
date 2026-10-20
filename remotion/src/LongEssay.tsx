// Длинное видео-эссе 16:9 (20.10.2026, первое - long_04_apathy «Почему ничего не хочется»).
// Фон - оживлённые классические картины (медленный проезд камеры, дымка, лучи), меняются вместе с поворотом сюжета;
// вставки из стоков в примерах; заставки глав, крупные мысли, цитаты, счётчик «3 причины», схемы; субтитры как в шортсах.
import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, SceneView } from "./AutoInfo";
import { Captions, clamp, setAccent, Word } from "./infokit";
import "./fonts";

const GOLD = "#E2BE6E", WHITE = "#F6F2EA", RED = "#D8453B";
const ease = Easing.bezier(0.45, 0, 0.25, 1);

type Block = { src: string; start: number; end: number; from: [number, number, number]; to: [number, number, number]; fx?: "fog" | "rays" };
type Cue =
  | { kind: "chapter"; at: number; dur: number; label: string; title: string }
  | { kind: "big"; at: number; dur: number; text: string; gold?: boolean; red?: boolean }
  | { kind: "quote"; at: number; dur: number; text: string; author: string }
  | { kind: "scene"; at: number; dur: number; scene: Scene }
  | { kind: "flip"; at: number; dur: number; a: string; b: string }
  | { kind: "spiral"; at: number; dur: number; items: string[] }
  | { kind: "steps3"; at: number; dur: number; items: string[]; times: number[] }
  | { kind: "endcard"; at: number; dur: number }
  | { kind: "duo"; at: number; dur: number; left: string; leftSub: string; right: string; rightSub: string }
  | { kind: "xlist"; at: number; dur: number; title: string; items: string[]; times: number[] }
  | { kind: "chip"; at: number; dur: number; text: string };

export type EssayProps = {
  id: string;
  total: number;
  segments: { text: string; start: number; end: number }[];
  words: Word[];
  blocks: Block[];
  brolls: { src: string; at: number; dur: number }[];
  cues: Cue[];
  tracker?: { show: [number, number]; fills: number[]; labels: string[] };
  gray?: [number, number][];
  music?: string;
  sfx?: { s: string; at: number; v: number }[];
};

// ---------- фон: оживлённые картины ----------
const Painting: React.FC<{ b: Block; t: number; gray: number }> = ({ b, t, gray }) => {
  const k = interpolate(t, [b.start, b.end], [0, 1], { ...clamp, easing: ease });
  const [s0, x0, y0] = b.from, [s1, x1, y1] = b.to;
  const s = s0 + (s1 - s0) * k, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
  const fade = Math.min(interpolate(t, [b.start - 1, b.start + 1], [0, 1], clamp), interpolate(t, [b.end - 1, b.end + 1], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Img src={staticFile(b.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s}) translate(${x}%, ${y}%)`,
        filter: `brightness(0.6) saturate(${0.95 - gray * 0.9}) contrast(1.05)` }} />
      {b.fx === "fog" ? <Fog t={t} /> : null}
      {b.fx === "rays" ? <Rays t={t} /> : null}
    </AbsoluteFill>
  );
};

const Fog: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen" }}>
    {[0, 1, 2].map((k) => (
      <div key={k} style={{ position: "absolute", left: `${-40 + ((t * (2 + k) + k * 37) % 140)}%`, top: `${45 + k * 12}%`, width: "70%", height: "40%",
        background: "radial-gradient(ellipse at center, rgba(220,225,235,0.16) 0%, rgba(220,225,235,0) 70%)", filter: "blur(10px)" }} />
    ))}
  </AbsoluteFill>
);

const Rays: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.55 }}>
    <div style={{ position: "absolute", left: "-20%", top: "-60%", width: "140%", height: "160%", transformOrigin: "60% 0%", transform: `rotate(${Math.sin(t * 0.08) * 3}deg)`,
      background: "repeating-conic-gradient(from 160deg at 60% 0%, rgba(255,214,150,0.10) 0deg 3deg, rgba(255,214,150,0) 3deg 9deg)" }} />
  </AbsoluteFill>
);

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.05, mixBlendMode: "overlay" }}>
        <filter id="eg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(frame / 2) % 20} /></filter>
        <rect width="100%" height="100%" filter="url(#eg)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------- слои поверх ----------
const useK = (dur: number, inS = 0.6, outS = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return { t, k: Math.min(interpolate(t, [0, inS], [0, 1], { ...clamp, easing: ease }), interpolate(t, [dur - outS, dur], [1, 0], clamp)) };
};

const ChapterCard: React.FC<{ label: string; title: string; dur: number }> = ({ label, title, dur }) => {
  const { t, k } = useK(dur, 0.8, 0.8);
  const line = interpolate(t, [0.3, 1.4], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 120, opacity: k, background: `rgba(6,6,8,${0.35 * k})` }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 34, letterSpacing: 16, color: GOLD }}>{label}</div>
      <div style={{ width: 380 * line, height: 3, background: GOLD, margin: "26px 0" }} />
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 116, color: WHITE, letterSpacing: 3, textAlign: "center", maxWidth: 1600, lineHeight: 1.05,
        textShadow: "0 8px 40px rgba(0,0,0,0.8)", translate: `0px ${(1 - k) * 24}px` }}>{title}</div>
    </AbsoluteFill>
  );
};

const BigLine: React.FC<{ text: string; gold?: boolean; red?: boolean; dur: number }> = ({ text, gold, red, dur }) => {
  const { k } = useK(dur);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 180, opacity: k }}>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: text.length > 30 ? 84 : 104, lineHeight: 1.1, color: red ? RED : gold ? GOLD : WHITE,
        textAlign: "center", maxWidth: 1500, letterSpacing: 2, textShadow: "0 8px 40px rgba(0,0,0,0.85)", scale: interpolate(k, [0, 1], [0.97, 1]) }}>{text}</div>
    </AbsoluteFill>
  );
};

const QuoteCard: React.FC<{ text: string; author: string; dur: number }> = ({ text, author, dur }) => {
  const { t, k } = useK(dur, 0.9, 0.9);
  const words = text.split(" ");
  const shown = interpolate(t, [0.4, Math.min(dur * 0.6, 0.35 * words.length + 0.4)], [0, words.length], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 170, opacity: k, background: `rgba(6,6,8,${0.3 * k})` }}>
      <div style={{ maxWidth: 1400, textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 200, color: GOLD, lineHeight: 0.5, opacity: 0.85 }}>“</div>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: text.length > 80 ? 60 : 72, lineHeight: 1.3, color: WHITE, textShadow: "0 6px 30px rgba(0,0,0,0.85)" }}>
          {words.map((w, i) => <span key={i} style={{ opacity: i < shown ? 1 : 0.12 }}>{w} </span>)}
        </div>
        <div style={{ marginTop: 34, fontFamily: "Montserrat", fontWeight: 700, fontSize: 34, letterSpacing: 10, color: GOLD }}>{author.toUpperCase()}</div>
      </div>
    </AbsoluteFill>
  );
};

const Flip: React.FC<{ a: string; b: string; dur: number }> = ({ a, b, dur }) => {
  const { t, k } = useK(dur);
  const cross = interpolate(t, [1.6, 2.3], [0, 1], { ...clamp, easing: ease });
  const second = interpolate(t, [2.8, 3.6], [0, 1], { ...clamp, easing: ease });
  const row = (x: string, y: string, col: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 40, fontFamily: "Oswald", fontWeight: 700, fontSize: 92, color: col }}>
      <span>{x}</span><span style={{ color: GOLD, fontSize: 80 }}>→</span><span>{y}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 180, opacity: k, gap: 40 }}>
      <div style={{ position: "relative", opacity: 1 - second * 0.55 }}>
        {row(a, b, "rgba(246,242,234,0.9)")}
        <div style={{ position: "absolute", left: 0, top: "52%", height: 8, width: `${cross * 100}%`, background: RED, borderRadius: 4 }} />
      </div>
      <div style={{ opacity: second, translate: `0px ${(1 - second) * 20}px` }}>{row(b, a, GOLD)}</div>
    </AbsoluteFill>
  );
};

const Spiral: React.FC<{ items: string[]; dur: number }> = ({ items, dur }) => {
  const { t, k } = useK(dur);
  const R = 270;
  const rot = t * 18;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 160, opacity: k }}>
      <div style={{ position: "relative", width: 2 * R + 420, height: 2 * R + 160 }}>
        <svg width={2 * R + 420} height={2 * R + 160} style={{ position: "absolute" }}>
          <g transform={`translate(${R + 210} ${R + 80})`} style={{ strokeDashoffset: -rot * 4 } as React.CSSProperties}>
            <ellipse rx={R * 1.75} ry={R * 0.95} fill="none" stroke="rgba(216,69,59,0.8)" strokeWidth={8} strokeDasharray="34 24" />
          </g>
        </svg>
        {items.map((it, i) => {
          const a = (-90 + (i * 360) / items.length) * (Math.PI / 180);
          const show = interpolate(t, [0.4 + i * 0.9, 1.0 + i * 0.9], [0, 1], clamp);
          return (
            <div key={i} style={{ position: "absolute", left: R + 210 + Math.cos(a) * R * 1.75, top: R + 80 + Math.sin(a) * R * 0.95, transform: "translate(-50%, -50%)", opacity: show,
              fontFamily: "Oswald", fontWeight: 700, fontSize: 64, color: WHITE, background: "rgba(10,10,14,0.8)", border: `4px solid ${RED}`, padding: "10px 26px",
              borderRadius: 14, whiteSpace: "nowrap" }}>{it}</div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Steps3: React.FC<{ items: string[]; times: number[]; dur: number }> = ({ items, times, dur }) => {
  const { t, k } = useK(dur, 0.6, 0.8);
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 260, paddingBottom: 200, opacity: k }}>
      {items.map((it, i) => {
        const s = interpolate(t, [times[i], times[i] + 0.6], [0, 1], { ...clamp, easing: ease });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 34, margin: "18px 0", opacity: Math.max(0.15, s), translate: `${(1 - s) * 40}px 0px` }}>
            <div style={{ width: 92, height: 92, borderRadius: 46, background: s > 0.5 ? GOLD : "transparent", border: `4px solid ${GOLD}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontFamily: "Oswald", fontWeight: 700, fontSize: 52, color: s > 0.5 ? "#111" : GOLD }}>{i + 1}</div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 76, color: WHITE, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>{it}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Две колонки крупно: слева плохое (красное), справа хорошее (золото). */
const Duo: React.FC<{ left: string; leftSub: string; right: string; rightSub: string; dur: number }> = ({ left, leftSub, right, rightSub, dur }) => {
  const { t, k } = useK(dur);
  const r = interpolate(t, [0.9, 1.6], [0, 1], { ...clamp, easing: ease });
  const col = (title: string, sub: string, c: string, kk: number) => (
    <div style={{ width: 640, textAlign: "center", opacity: kk, translate: `0px ${(1 - kk) * 20}px` }}>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 104, color: c, textShadow: "0 8px 40px rgba(0,0,0,0.8)" }}>{title}</div>
      <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 44, color: WHITE, marginTop: 6 }}>{sub}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 200, opacity: k }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        {col(left, leftSub, RED, 1)}
        <div style={{ width: 4, height: 220, background: "rgba(246,242,234,0.35)" }} />
        {col(right, rightSub, GOLD, r)}
      </div>
    </AbsoluteFill>
  );
};

/** Крупный список с красными крестиками: пункты появляются под голос. */
const XList: React.FC<{ title: string; items: string[]; times: number[]; dur: number }> = ({ title, items, times, dur }) => {
  const { t, k } = useK(dur);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 200, opacity: k }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 36, letterSpacing: 14, color: GOLD, marginBottom: 26 }}>{title}</div>
      <div style={{ display: "flex", gap: 46 }}>
        {items.map((it, i) => {
          const s = interpolate(t, [times[i], times[i] + 0.5], [0, 1], { ...clamp, easing: ease });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: Math.max(0.12, s), scale: interpolate(s, [0, 1], [0.92, 1]) }}>
              <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 64, color: RED }}>✕</div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 78, color: WHITE, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>{it}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Плашка в углу («ПРИМЕР ИЗ ЖИЗНИ»). */
const Chip: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const { k } = useK(dur, 0.5, 0.5);
  return (
    <div style={{ position: "absolute", top: 50, left: 70, opacity: k, translate: `${(1 - k) * -30}px 0px`, fontFamily: "Montserrat", fontWeight: 800,
      fontSize: 28, letterSpacing: 8, color: "#111", background: GOLD, padding: "10px 24px", borderRadius: 10 }}>{text}</div>
  );
};

/** Счётчик «3 причины» в углу: кружки заполняются, когда начинается очередная причина. */
const Tracker: React.FC<{ show: [number, number]; fills: number[]; labels: string[]; t: number }> = ({ show, fills, labels, t }) => {
  const k = Math.min(interpolate(t, [show[0], show[0] + 0.8], [0, 1], clamp), interpolate(t, [show[1] - 0.8, show[1]], [1, 0], clamp));
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", top: 54, right: 70, display: "flex", gap: 16, opacity: k * 0.95 }}>
      {labels.map((l, i) => {
        const on = interpolate(t, [fills[i], fills[i] + 0.6], [0, 1], clamp);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Montserrat", fontWeight: 700, fontSize: 22, letterSpacing: 3,
            color: on > 0.5 ? GOLD : "rgba(246,242,234,0.5)" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `3px solid ${GOLD}`, background: on > 0.5 ? GOLD : "transparent", scale: 1 + Math.sin(on * Math.PI) * 0.4 }} />
            {l}
          </div>
        );
      })}
    </div>
  );
};

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", width: 1080, height: 1920, left: (1920 - 1080 * 0.86) / 2, top: 110 - 300 * 0.86, scale: 0.86, transformOrigin: "0 0" }}>{children}</div>
);

const EndCard: React.FC<{ dur: number }> = ({ dur }) => {
  const { k } = useK(dur, 1.2, 0.01);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: k, background: `rgba(6,6,8,${0.55 * k})` }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 34, letterSpacing: 16, color: GOLD }}>TELEGRAM-КАНАЛ</div>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 150, color: WHITE, letterSpacing: 10, marginTop: 14 }}>UNTAMESSE</div>
      <div style={{ marginTop: 30, fontFamily: "Montserrat", fontWeight: 800, fontSize: 42, color: "#111", background: GOLD, padding: "16px 44px", borderRadius: 16 }}>
        ХАРАКТЕР И ДЕНЬГИ · ССЫЛКА В ОПИСАНИИ
      </div>
    </AbsoluteFill>
  );
};

export const LongEssay: React.FC<EssayProps> = (p) => {
  setAccent(GOLD, "ru");
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const f = (x: number) => Math.round(x * fps);
  const gray = (p.gray ?? []).reduce((g, [a, b]) => Math.max(g, Math.min(interpolate(t, [a, a + 2.5], [0, 1], clamp), interpolate(t, [b - 1.5, b], [1, 0], clamp))), 0);
  const end = p.segments[p.segments.length - 1].end;
  return (
    <AbsoluteFill style={{ background: "#08080A" }}>
      {p.blocks.map((b, i) => (t > b.start - 1.2 && t < b.end + 1.2 ? <Painting key={i} b={b} t={t} gray={gray} /> : null))}
      {p.brolls.map((b, i) => (
        <Sequence key={`br${i}`} from={f(b.at)} durationInFrames={f(b.dur)}>
          <BrollClip src={b.src} dur={b.dur} />
        </Sequence>
      ))}
      <Grain />
      {p.tracker ? <Tracker {...p.tracker} t={t} /> : null}
      {p.cues.map((c, i) => (
        <Sequence key={`c${i}`} from={f(c.at)} durationInFrames={Math.max(1, f(c.dur))}>
          {c.kind === "chapter" ? <ChapterCard label={c.label} title={c.title} dur={c.dur} /> :
           c.kind === "big" ? <BigLine text={c.text} gold={c.gold} red={c.red} dur={c.dur} /> :
           c.kind === "quote" ? <QuoteCard text={c.text} author={c.author} dur={c.dur} /> :
           c.kind === "flip" ? <Flip a={c.a} b={c.b} dur={c.dur} /> :
           c.kind === "spiral" ? <Spiral items={c.items} dur={c.dur} /> :
           c.kind === "steps3" ? <Steps3 items={c.items} times={c.times} dur={c.dur} /> :
           c.kind === "endcard" ? <EndCard dur={c.dur} /> :
           c.kind === "duo" ? <Duo {...c} /> :
           c.kind === "xlist" ? <XList {...c} /> :
           c.kind === "chip" ? <Chip text={c.text} dur={c.dur} /> :
           <SceneFade dur={c.dur}><Stage><SceneView s={c.scene} dur={c.dur} /></Stage></SceneFade>}
        </Sequence>
      ))}
      {/* субтитры выше и шире: две строки не уходят за нижний край (владелец 20.10.2026) */}
      <Captions words={p.words} until={end + 0.3} top={868} maxWidth={1560} />
      <Audio src={staticFile(`auto/${p.id}/voice.wav`)} />
      {p.music ? <EssayMusic src={p.music} total={p.total} /> : null}
      {(p.sfx ?? []).map((x, k) => (
        <Sequence key={`sfx${k}`} from={Math.max(0, f(x.at))} durationInFrames={f(1.5)}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const { k } = useK(dur, 0.5, 0.6);
  return <AbsoluteFill style={{ opacity: k }}>{children}</AbsoluteFill>;
};

const BrollClip: React.FC<{ src: string; dur: number }> = ({ src, dur }) => {
  const { k } = useK(dur, 0.7, 0.7);
  return (
    <AbsoluteFill style={{ opacity: k }}>
      <Video src={staticFile(src)} muted objectFit="cover" style={{ width: "100%", height: "100%", filter: "brightness(0.62) saturate(0.85) contrast(1.05)" }} />
    </AbsoluteFill>
  );
};

const EssayMusic: React.FC<{ src: string; total: number }> = ({ src, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Audio src={staticFile(src)} volume={interpolate(frame / fps, [0, 2, total - 4, total], [0, 0.15, 0.15, 0], clamp)} />
  );
};

export const calcEssay = ({ props }: { props: EssayProps }) => ({ durationInFrames: Math.ceil(props.total * 30) });
