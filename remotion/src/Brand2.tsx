// Оформление «Survive The Scenario» v2 (20.10.2026): векторный знак в духе «Большой волны» - закрученная волна
// с пенными когтями, янтарное солнце, силуэт на скале. Три цвета: ночной синий, янтарь, ледяной белый.
import React from "react";
import { AbsoluteFill } from "remotion";
import "./fonts";

const NAVY = "#0A1426", NAVY2 = "#13223D", TEAL = "#1E6F96", TEAL2 = "#2C8DBA", ICE = "#EAF6FF", AMBER = "#FFB52E", AMBER2 = "#FF8A1F";

/** Знак 1000x1000 (рисуется в любой масштаб). */
export const Mark: React.FC<{ glow?: boolean; bg?: boolean; figure?: boolean }> = ({ glow = true, bg = true, figure = true }) => {
  // пенные «когти» свисают с кромки завитка (как у Хокусая)
  const claws = [[712, 438, 150, 30], [728, 474, 165, 28], [727, 510, 185, 25], [712, 541, 205, 22], [690, 565, 225, 19], [664, 580, 240, 16]];
  return (
    <g>
      <defs>
        <radialGradient id="m_sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="0.7" stopColor={AMBER} />
          <stop offset="1" stopColor={AMBER2} />
        </radialGradient>
        <radialGradient id="m_glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={AMBER} stopOpacity={0.55} />
          <stop offset="1" stopColor={AMBER} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="m_bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NAVY2} />
          <stop offset="1" stopColor={NAVY} />
        </linearGradient>
        <linearGradient id="m_face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={TEAL2} />
          <stop offset="1" stopColor={TEAL} />
        </linearGradient>
      </defs>
      {bg ? <rect x={0} y={0} width={1000} height={1000} fill="url(#m_bg)" /> : null}
      {glow ? <circle cx={660} cy={430} r={330} fill="url(#m_glow)" /> : null}
      <circle cx={660} cy={430} r={210} fill="url(#m_sun)" />
      {/* полосы на солнце - как на ретро-постерах */}
      
      {figure ? (
        <g>
      <path d="M640 1000 L700 760 Q730 720 770 730 L860 704 Q900 694 930 722 L1000 760 L1000 1000 Z" fill="#050A14" />
      <path d="M700 760 Q730 720 770 730 L860 704 Q900 694 930 722" stroke={AMBER} strokeWidth={4} fill="none" opacity={0.55} />
      <g transform="translate(830 712)" fill="#050A14">
        <circle cx={0} cy={-118} r={15} />
        <path d="M-14 -100 L14 -100 L20 -50 L10 -48 L12 0 L2 0 L0 -40 L-2 0 L-12 0 L-10 -48 L-20 -50 Z" />
        <path d="M14 -96 L40 -128 L46 -124 L22 -88 Z" />
        <rect x={-30} y={-96} width={16} height={34} rx={4} />
      </g>
        </g>
      ) : null}
      {/* волна: тёмная толща, светлая стенка, завиток, пена */}
      <path d="M0 1000 L0 760 C80 700 150 610 210 520 C270 420 360 330 470 300 C600 265 720 330 745 440
        C765 530 700 600 620 590 C560 582 535 520 575 485 C600 463 640 475 640 500 C620 486 595 498 600 520
        C610 560 680 560 700 510 C690 610 600 660 520 650 C440 640 400 700 420 780 C440 860 520 930 640 1000 Z" fill={NAVY2} />
      <path d="M0 1000 L0 790 C90 730 160 640 225 545 C285 455 365 375 465 345 C580 312 690 365 705 455
        C715 520 670 560 620 552 C640 600 560 640 500 630 C420 620 360 690 380 790 C395 870 450 940 540 1000 Z" fill="url(#m_face)" />
      {/* белые прожилки на стенке */}
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${40 + k * 55} ${960 - k * 20} C${120 + k * 50} ${800 - k * 40} ${210 + k * 40} ${640 - k * 50} ${330 + k * 30} ${520 - k * 50}`}
          stroke={ICE} strokeWidth={10 - k * 1.5} fill="none" strokeLinecap="round" opacity={0.55 - k * 0.08} />
      ))}
      {/* пенный гребень и когти */}
      <path d="M230 540 C290 440 370 360 470 330 C585 297 700 352 718 450" stroke={ICE} strokeWidth={30} fill="none" strokeLinecap="round" />
      {claws.map(([x, y, a, r], k) => (
        <g key={k} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d={`M0 ${-r * 0.5} C${r * 1.2} ${-r * 0.6} ${r * 2.0} ${-r * 0.1} ${r * 2.2} ${r * 0.9} C${r * 1.6} ${r * 0.3} ${r * 0.9} ${r * 0.25} ${r * 0.2} ${r * 0.5} C${-r * 0.2} ${r * 0.3} ${-r * 0.3} ${-r * 0.2} 0 ${-r * 0.5} Z`} fill={ICE} />
        </g>
      ))}
      {/* брызги */}
      {[[760, 380, 12], [790, 420, 8], [775, 460, 6], [810, 360, 7], [735, 340, 9]].map(([x, y, r], k) => <circle key={k} cx={x} cy={y} r={r} fill={ICE} />)}
    </g>
  );
};

export const BrandAvatar2: React.FC = () => (
  <AbsoluteFill>
    <svg width={1080} height={1080} viewBox="0 0 1000 1000">
      <Mark />
    </svg>
  </AbsoluteFill>
);

// значки сценариев для баннера (тонкие линии)
const Ico: React.FC<{ kind: string; x: number; y: number }> = ({ kind, x, y }) => {
  const s = { stroke: AMBER, strokeWidth: 7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={0} r={62} fill="none" stroke="rgba(255,181,46,0.35)" strokeWidth={3} />
      {kind === "wave" && <path d="M-36 14 C-24 -10 -4 -24 16 -20 C30 -17 34 -2 22 4 C14 8 6 0 12 -6 M-40 22 C-20 30 20 30 40 20" {...s} />}
      {kind === "fire" && <path d="M0 -36 C10 -16 30 -8 26 14 A26 26 0 0 1 -26 14 C-28 0 -16 -8 -12 -22 C-6 -10 -2 -8 0 -36 Z" {...s} />}
      {kind === "snow" && <path d="M0 -36 L0 36 M-31 -18 L31 18 M-31 18 L31 -18 M-8 -28 L0 -20 L8 -28 M-8 28 L0 20 L8 28" {...s} />}
      {kind === "bolt" && <path d="M8 -38 L-16 4 L2 4 L-8 38 L18 -6 L0 -6 Z" {...s} />}
      {kind === "peak" && <path d="M-40 28 L-12 -24 L4 4 L14 -10 L40 28 Z M-20 -8 L-12 -24 L-4 -8" {...s} />}
    </g>
  );
};

/** Баннер YouTube 2560x1440: волна без рамки уходит за левый край, справа скала с человеком,
 *  название в одну строку - в безопасной зоне (центр 1546x423), видна на телефоне и компьютере. */
export const BrandBanner2: React.FC = () => (
  <AbsoluteFill style={{ background: NAVY }}>
    <svg width={2560} height={1440} viewBox="0 0 2560 1440" style={{ position: "absolute" }}>
      <defs>
        <radialGradient id="b_glow" cx="0.55" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#1C3159" />
          <stop offset="1" stopColor={NAVY} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={2560} height={1440} fill="url(#b_glow)" />
      {Array.from({ length: 90 }).map((_, k) => {
        const r = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
        return <circle key={k} cx={r(k) * 2560} cy={r(k + 300) * 700} r={1.5 + r(k + 600) * 2.5} fill="#fff" opacity={0.25 + r(k + 900) * 0.4} />;
      })}
      <g transform="translate(-430 210) scale(1.25)">
        <Mark glow bg={false} figure={false} />
      </g>
      {/* скала с человеком справа */}
      <path d="M2150 1440 L2230 1060 Q2270 1000 2330 1015 L2440 985 Q2500 970 2560 1010 L2560 1440 Z" fill="#050A14" />
      <path d="M2230 1060 Q2270 1000 2330 1015 L2440 985 Q2500 970 2560 1010" stroke={AMBER} strokeWidth={5} fill="none" opacity={0.6} />
      <g transform="translate(2395 992) scale(1.5)" fill="#050A14">
        <circle cx={0} cy={-118} r={15} />
        <path d="M-14 -100 L14 -100 L20 -50 L10 -48 L12 0 L2 0 L0 -40 L-2 0 L-12 0 L-10 -48 L-20 -50 Z" />
        <path d="M-14 -96 L-40 -128 L-46 -124 L-22 -88 Z" />
        <rect x={14} y={-96} width={16} height={34} rx={4} />
      </g>
      <circle cx={2395} cy={800} r={150} fill="url(#m_glow)" opacity={0.0} />
      {["wave", "fire", "snow", "bolt", "peak"].map((k, i) => <Ico key={k} kind={k} x={1100 + i * 180} y={1060} />)}
    </svg>
    <AbsoluteFill style={{ left: 700, top: 560, width: 1360, alignItems: "center" }}>
      <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 34, letterSpacing: 16, color: AMBER }}>COULD YOU SURVIVE IT?</div>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 150, lineHeight: 1, color: ICE, marginTop: 10, letterSpacing: 2,
        textShadow: "0 10px 40px rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}>
        SURVIVE THE <span style={{ color: AMBER }}>SCENARIO</span>
      </div>
      <div style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 36, color: "rgba(234,246,255,0.78)", marginTop: 18 }}>
        Real survival scenarios, animated · A new one every day
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
