// Оформление английского канала «Survive The Scenario» (20.10.2026): аватарка и баннер в стиле роликов -
// ночь, детальная волна, отель, человечек на крыше. Рендер: npx remotion still ... BrandAvatar / BrandBanner.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Building, C, Person, rnd, Water } from "./flat";
import "./fonts";

const Sky: React.FC<{ w: number; h: number; stars?: number }> = ({ w, h, stars = 80 }) => (
  <>
    <defs>
      <linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0B1020" />
        <stop offset="1" stopColor="#1F2A48" />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={w} height={h} fill="url(#bsky)" />
    {Array.from({ length: stars }).map((_, k) => (
      <circle key={k} cx={rnd(k) * w} cy={rnd(k + 300) * h * 0.6} r={1.5 + rnd(k + 600) * 2.5} fill="#fff" opacity={0.3 + rnd(k + 900) * 0.5} />
    ))}
  </>
);

/** Аватарка 1080x1080: крупная волна слева, отель справа, на крыше герой; хорошо читается даже в маленьком кружке. */
export const BrandAvatar: React.FC = () => (
  <AbsoluteFill>
    <svg width={1080} height={1080} viewBox="0 0 1080 1080">
      <Sky w={1080} h={1080} stars={50} />
      <circle cx={820} cy={240} r={90} fill="#E8E4D8" opacity={0.9} />
      <g transform="translate(-40 40) scale(1.05)">
        <Building x={560} base={1000} w={330} floors={9} fh={70} seed={9} lit={0.55} />
        <Person x={725} y={1000 - 9 * 70} s={1.55} color="#FF8C42" seed={4} wave={1.2} walk={0.55} dir={-1} />
      </g>
      <g transform="translate(-1650 120) scale(1.25)">
        <Water level={800} front={1700} t={0.6} w={3000} crest />
      </g>
    </svg>
    {/* кольцо цвета канала: под круглую обрезку */}
    <AbsoluteFill style={{ borderRadius: "50%", boxShadow: "inset 0 0 0 26px #FFC83D" }} />
  </AbsoluteFill>
);

/** Баннер YouTube 2560x1440: безопасная зона по центру 1546x423 - там название и слоган, дома - справа за её краем. */
export const BrandBanner: React.FC = () => (
  <AbsoluteFill>
    <svg width={2560} height={1440} viewBox="0 0 2560 1440">
      <Sky w={2560} h={1440} stars={160} />
      <circle cx={1900} cy={300} r={66} fill="#E8E4D8" opacity={0.85} />
      {Array.from({ length: 22 }).map((_, k) => (
        <rect key={k} x={560 + k * 92} y={1000 - 90 - rnd(k) * 200} width={84} height={600} fill="#141A2A" />
      ))}
      <g transform="translate(-1200 250)">
        <Water level={760} front={1560} t={0.6} w={4000} crest />
      </g>
      {/* набережная поверх воды - без вертикального края */}
      <rect x={0} y={1010} width={2560} height={60} fill="#2E333E" />
      <rect x={0} y={1004} width={2560} height={8} fill="#8A909B" />
      {Array.from({ length: 22 }).map((_, k) => <rect key={`m${k}`} x={40 + k * 120} y={1036} width={50} height={5} fill="#C9CCD2" opacity={0.7} />)}
      <rect x={0} y={1070} width={2560} height={400} fill="#20242E" />
      <Building x={2090} base={1006} w={300} floors={9} fh={62} seed={9} lit={0.55} />
      <Building x={2400} base={1006} w={220} floors={5} fh={62} seed={5} lit={0.45} color="#6E7686" />
      <Person x={2240} y={1006 - 9 * 62} s={1.5} color="#FF8C42" seed={4} wave={1.2} walk={0.55} dir={-1} />
    </svg>
    {/* текст в безопасной зоне (видна на всех устройствах) */}
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginTop: -40 }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 150, color: C.white, letterSpacing: 6, lineHeight: 1,
          textShadow: "0 8px 30px rgba(0,0,0,0.8)" }}>
          SURVIVE <span style={{ color: C.yellow }}>THE</span> SCENARIO
        </div>
        <div style={{ marginTop: 26, fontFamily: "Montserrat", fontWeight: 800, fontSize: 46, letterSpacing: 10, color: "#111",
          background: C.yellow, display: "inline-block", padding: "12px 34px", borderRadius: 14 }}>
          COULD YOU SURVIVE IT? · NEW SCENARIO DAILY
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
