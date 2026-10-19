// Универсальный шорт в стиле «Инфографика» (утверждён владельцем 17.10.2026 по примерам Карнеги и Форда).
// Всё приходит в props из Python (info_short.py): голос, слова со временем, фразы, план анимаций по фразам.
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Attempts,
  Bars,
  BigCounter,
  Captions,
  Cta,
  Donut,
  Drain,
  GOLD,
  Header,
  InfoBG,
  LineChart,
  RED,
  Steps,
  Tiles,
  Title,
  Word,
} from "./infokit";
import {
  Calendar, Checklist, CoinStack, Columns, Gauge, Marker, Notify, Odometer, QuoteCard, Receipt, Ring, Scale, Stamp, Stairs, Typewriter,
  Versus, Waffle, WordStack,
} from "./infokit2";
import { Meter, Timeline } from "./infokit3";
import { setAccent } from "./infokit";

const GREY = "rgba(246,242,234,0.35)";

export type Scene =
  | { type: "counter"; to: number; prefix?: string; suffix?: string; label?: string; bad?: boolean }
  | { type: "title"; text: string; gold?: boolean; red?: boolean }
  | { type: "bars"; title: string; items: { label: string; good: boolean; strike?: boolean }[] }
  | { type: "line"; shape: "crash" | "rise" | "dip_then_rise"; marks?: { at: "low" | "end"; text: string }[] }
  | { type: "donut"; segs: { label: string; bad?: boolean }[]; center?: string }
  | { type: "drain"; label: string }
  | { type: "tiles"; n: number; label: string }
  | { type: "steps"; steps: string[] }
  | { type: "attempts"; items: { title: string; note: string; ok: boolean }[] }
  | { type: "odometer"; to: number; prefix?: string; suffix?: string; label?: string }
  | { type: "ring"; pct: number; label: string; bad?: boolean }
  | { type: "gauge"; value: number; label: string; low?: string; high?: string }
  | { type: "waffle"; pct: number; label: string; bad?: boolean }
  | { type: "calendar"; to: number; label: string }
  | { type: "typewriter"; text: string; gold?: boolean }
  | { type: "marker"; text: string; mark: string }
  | { type: "stamp"; text: string }
  | { type: "wordstack"; words: string[] }
  | { type: "quote"; text: string; author?: string }
  | { type: "columns"; title?: string; items: { label: string; h: number; good?: boolean }[] }
  | { type: "versus"; left: string; right: string; leftSub?: string; rightSub?: string }
  | { type: "scale"; left: string; right: string; heavier: "left" | "right" }
  | { type: "checklist"; title?: string; items: { text: string; ok: boolean }[] }
  | { type: "receipt"; title: string; items: string[]; total: string }
  | { type: "notify"; app: string; text: string; bad?: boolean }
  | { type: "stairs"; steps: string[] }
  | { type: "coins"; label: string }
  | { type: "meter"; from: number; to: number; unit?: string; label?: string; marks?: { v: number; text: string; bad?: boolean }[] }
  | { type: "timeline"; items: { year: string; text: string; bad?: boolean }[] }
  | { type: "none" };

export type AutoProps = {
  id: string;
  tag: string;
  cta: string;
  total: number;
  segments: { text: string; start: number; end: number }[];
  words: Word[];
  scenes: Scene[]; // по одной на фразу
  music?: string; // путь в public/ к фоновой музыке (без авторских прав), громкость 15%
  sfx?: { s: string; at: number; v: number }[]; // звуки анимаций (public/sfx/*.wav, синтезированы make_sfx.py)
  accent?: string; // цвет акцента ниши (по умолчанию золото UNTAMESSE)
  lang?: string;
  ctaSmall?: string;
  ctaWhere?: string;
};

const SHAPES: Record<string, { pts: [number, number][]; low: number; hot: number }> = {
  crash: { pts: [[0, 0.8], [0.2, 0.85], [0.4, 0.6], [0.55, 0.65], [0.75, 0.3], [1, 0.08]], low: 5, hot: 99 },
  rise: { pts: [[0, 0.1], [0.2, 0.18], [0.4, 0.3], [0.55, 0.42], [0.75, 0.66], [1, 1.02]], low: 0, hot: 2 },
  dip_then_rise: { pts: [[0, 0.45], [0.12, 0.5], [0.25, 0.22], [0.4, 0.4], [0.6, 0.58], [0.8, 0.8], [1, 1.04]], low: 2, hot: 2 },
};

export const SceneView: React.FC<{ s: Scene; dur: number }> = ({ s, dur }) => {
  switch (s.type) {
    case "counter":
      return <BigCounter to={s.to} prefix={s.prefix} suffix={s.suffix} label={s.label} top={360} color={s.bad ? RED : GOLD} />;
    case "title":
      return <Title text={s.text} top={560} size={s.text.length > 22 ? 96 : 124} color={s.red ? RED : s.gold === false ? undefined : GOLD} />;
    case "bars": {
      const n = s.items.length;
      return (
        <Bars
          title={s.title}
          items={s.items.map((it, k) => ({
            label: it.label,
            w: it.good ? 860 : 330,
            color: it.good ? GOLD : it.strike ? GREY : RED,
            strike: it.strike,
            at: 0.3 + (k * Math.max(0.9, dur - 1.4)) / Math.max(1, n),
          }))}
        />
      );
    }
    case "line": {
      const sh = SHAPES[s.shape] ?? SHAPES.rise;
      const last = sh.pts.length - 1;
      const marks = (s.marks ?? []).map((m) => ({
        i: m.at === "low" ? sh.low : last,
        text: m.text,
        color: m.at === "low" && s.shape !== "rise" ? RED : GOLD,
        at: m.at === "low" ? dur * 0.45 : dur * 0.85,
      }));
      return <LineChart pts={sh.pts} drawTo={[{ at: dur * 0.5, upto: sh.low + 1 }, { at: dur * 0.9, upto: sh.pts.length }]} marks={marks} hot={sh.hot} />;
    }
    case "donut": {
      const n = s.segs.length;
      return (
        <Donut
          segs={s.segs.map((g, k) => ({
            label: g.label,
            v: 1 + ((k * 7) % 3) * 0.4,
            color: g.bad ? (k % 2 ? "#B8352C" : RED) : ["#8A8478", "#ABA496", "#6B665D"][k % 3],
            at: 0.15 + (k * Math.max(0.8, dur - 1.2)) / n,
            pulse: g.bad && k === n - 1,
          }))}
          center={s.center}
          centerAt={dur * 0.8}
        />
      );
    }
    case "drain":
      return <Drain label={s.label} dur={dur} />;
    case "tiles":
      return <Tiles n={Math.min(4, Math.max(1, s.n))} label={s.label} top={620} />;
    case "steps":
      return <Steps steps={s.steps.map((label, k) => ({ label, at: 0.3 + (k * Math.max(0.8, dur - 1.0)) / s.steps.length, gold: k === s.steps.length - 1 }))} />;
    case "attempts":
      return (
        <Attempts
          items={s.items.map((it, k) => ({ ...it, at: 0.2 + (k * Math.max(0.8, dur - 1.2)) / s.items.length }))}
        />
      );
    case "odometer":
      return <Odometer to={s.to} prefix={s.prefix} suffix={s.suffix} label={s.label} />;
    case "ring":
      return <Ring pct={Math.min(100, Math.max(1, s.pct))} label={s.label} bad={s.bad} />;
    case "gauge":
      return <Gauge value={Math.min(1, Math.max(0, s.value))} label={s.label} low={s.low} high={s.high} />;
    case "waffle":
      return <Waffle pct={Math.min(100, Math.max(1, s.pct))} label={s.label} bad={s.bad} />;
    case "calendar":
      return <Calendar to={s.to} label={s.label} />;
    case "typewriter":
      return <Typewriter text={s.text} gold={s.gold} />;
    case "marker":
      return <Marker text={s.text} mark={s.mark} />;
    case "stamp":
      return <Stamp text={s.text} />;
    case "wordstack":
      return <WordStack words={s.words.slice(0, 4)} dur={dur} />;
    case "quote":
      return <QuoteCard text={s.text} author={s.author} />;
    case "columns":
      return <Columns title={s.title} items={s.items.slice(0, 5)} />;
    case "versus":
      return <Versus left={s.left} right={s.right} leftSub={s.leftSub} rightSub={s.rightSub} />;
    case "scale":
      return <Scale left={s.left} right={s.right} heavier={s.heavier} />;
    case "checklist":
      return <Checklist title={s.title} items={s.items.slice(0, 4)} dur={dur} />;
    case "receipt":
      return <Receipt title={s.title} items={s.items.slice(0, 5)} total={s.total} dur={dur} />;
    case "notify":
      return <Notify app={s.app} text={s.text} bad={s.bad} />;
    case "stairs":
      return <Stairs steps={s.steps.slice(0, 5)} dur={dur} />;
    case "coins":
      return <CoinStack label={s.label} />;
    case "meter":
      return <Meter from={s.from} to={s.to} unit={s.unit} label={s.label} marks={s.marks} dur={dur} />;
    case "timeline":
      return <Timeline items={s.items.slice(0, 5)} dur={dur} />;
    default:
      return null;
  }
};

const MUSIC_VOLUME = 0.15; // фон приглушён до 15% (решение владельца 17.10.2026)

export const Music: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile(src)}
      loop
      volume={interpolate(frame, [0, 1 * fps, durationInFrames - 1.5 * fps, durationInFrames], [0, MUSIC_VOLUME, MUSIC_VOLUME, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })}
    />
  );
};

export const AutoInfo: React.FC<AutoProps> = (p) => {
  setAccent(p.accent, p.lang);
  const { fps } = useVideoConfig();
  const f = (x: number) => Math.round(x * fps);
  const segs = p.segments;
  const cta = segs[segs.length - 1].end + 0.2;
  // сцена держится до начала следующей непустой сцены
  const ends = segs.map((s, i) => {
    let j = i + 1;
    while (j < segs.length && p.scenes[j]?.type === "none") j++;
    return j < segs.length ? segs[j].start : cta;
  });
  return (
    <AbsoluteFill>
      <InfoBG id={`auto/${p.id}`} />
      <Header tag={p.tag} />
      {segs.map((s, i) =>
        p.scenes[i] && p.scenes[i].type !== "none" ? (
          <Sequence key={i} name={`Сцена ${i + 1}: ${p.scenes[i].type}`} from={f(s.start)} durationInFrames={Math.max(1, f(ends[i] - s.start))}>
            <SceneView s={p.scenes[i]} dur={ends[i] - s.start} />
          </Sequence>
        ) : null,
      )}
      <Captions words={p.words} until={cta} />
      <Sequence name="Призыв" from={f(cta)}>
        <Cta big={p.cta} small={p.ctaSmall} where={p.ctaWhere} />
      </Sequence>
      <Audio src={staticFile(`auto/${p.id}/voice.wav`)} />
      {p.music ? <Music src={p.music} /> : null}
      {(p.sfx ?? []).map((x, k) => (
        <Sequence key={`sfx${k}`} name={`Звук ${x.s}`} from={Math.max(0, f(x.at))} durationInFrames={f(1.3)}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calcAuto: CalculateMetadataFunction<AutoProps> = ({ props }) => ({
  durationInFrames: Math.ceil(props.total * 30),
});
