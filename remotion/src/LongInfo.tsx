// Длинное видео 16:9 в стиле «Инфографика» (стандарт владельца 17-18.10.2026): те же анимации, что в шортсах,
// фон - цепочка разных плавных клипов без повторов по кругу, заставки глав, субтитры внизу.
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AutoProps, Music, SceneView } from "./AutoInfo";
import { Captions, clamp, Cta, GOLD, InfoBG, WHITE } from "./infokit";

export type LongProps = AutoProps & { chapters: { label: string; title: string; at: number }[] };

const S = 0.9; // вертикальная «сцена» 1080x1920 из шортсов, её рабочая часть (y 280..1220) - по центру кадра
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", width: 1080, height: 1920, left: (1920 - 1080 * S) / 2, top: 40 - 280 * S, scale: S, transformOrigin: "0 0" }}>
    {children}
  </div>
);

const ChapterCard: React.FC<{ label: string; title: string }> = ({ label, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.6 * fps], [0, 1], { ...clamp, easing: ease });
  const line = interpolate(frame, [0.3 * fps, 1.2 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140 }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 40, letterSpacing: 14, color: GOLD, opacity: k }}>{label}</div>
      <div style={{ width: 420 * line, height: 3, background: GOLD, margin: "28px 0" }} />
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 120, color: WHITE, opacity: k, translate: `0px ${(1 - k) * 30}px`,
        textShadow: "0 6px 30px rgba(0,0,0,0.8)", textAlign: "center", maxWidth: 1600, lineHeight: 1.05 }}>{title}</div>
    </AbsoluteFill>
  );
};

/** Сверху слева - в какой главе мы сейчас (тонко, не мешает). */
const ChapterTag: React.FC<{ label: string; title: string }> = ({ label, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.8 * fps], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", top: 46, left: 60, opacity: 0.8 * k, fontFamily: "Montserrat", fontWeight: 700, fontSize: 24,
      letterSpacing: 5, color: GOLD }}>
      {label} <span style={{ color: "rgba(246,242,234,0.7)", marginLeft: 12 }}>{title}</span>
    </div>
  );
};

export const LongInfo: React.FC<LongProps> = (p) => {
  const { fps } = useVideoConfig();
  const f = (x: number) => Math.round(x * fps);
  const segs = p.segments;
  const cta = segs[segs.length - 1].end + 0.3;
  const ends = segs.map((s, i) => {
    let j = i + 1;
    while (j < segs.length && p.scenes[j]?.type === "none") j++;
    return j < segs.length ? segs[j].start : cta;
  });
  const chEnd = (k: number) => (k + 1 < p.chapters.length ? p.chapters[k + 1].at : cta);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0A0908" }}>
      <InfoBG id={`auto/${p.id}`} />
      {p.chapters.map((c, k) =>
        c.label ? (
          <Sequence key={`t${k}`} name={`Глава ${c.label}`} from={f(c.at + 3)} durationInFrames={Math.max(1, f(chEnd(k) - c.at - 3))}>
            <ChapterTag label={c.label} title={c.title} />
          </Sequence>
        ) : null,
      )}
      {segs.map((s, i) => {
        const sc = p.scenes[i] as { type: string; label?: string; title?: string };
        if (!sc || sc.type === "none") return null;
        const d = ends[i] - s.start;
        return (
          <Sequence key={i} name={`Сцена ${i + 1}: ${sc.type}`} from={f(s.start)} durationInFrames={Math.max(1, f(d))}>
            {sc.type === "chapter" ? <ChapterCard label={sc.label ?? ""} title={sc.title ?? ""} /> : (
              <Stage><SceneView s={p.scenes[i]} dur={d} /></Stage>
            )}
          </Sequence>
        );
      })}
      <Captions words={p.words} until={cta} top={905} />
      <Sequence name="Призыв" from={f(cta)}>
        <Cta big={p.cta} where="ссылка в описании" />
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

export const calcLong: CalculateMetadataFunction<LongProps> = ({ props }) => ({ durationInFrames: Math.ceil(props.total * 30) });
