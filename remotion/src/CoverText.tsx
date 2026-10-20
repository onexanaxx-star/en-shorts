import React from "react";
import { AbsoluteFill } from "remotion";

// Обложка английских роликов (владелец 20.10.2026): весь текст - в середине кадра (y 280-1600),
// TikTok в сетке профиля обрезает обложку до 3:4 и низ/верх пропадают.
export type CoverSpec = { tag?: string; tagColor?: string; top: string[]; bottom?: string[]; scene?: number }; // scene - номер анимации ролика (крупное число) в середине обложки

const YEL = "#FFCD3C", WHITE = "#FAF8F2";
const fit = (lines: string[], base: number, width: number) => {
  // Oswald Bold: ширина буквы ~0.5 кегля - подбираем размер, чтобы самая длинная строка влезла
  const longest = Math.max(...lines.map((l) => l.length), 1);
  return Math.min(base, Math.floor(width / (longest * 0.5)));
};
const txt = (size: number, color: string): React.CSSProperties => ({
  fontFamily: "Oswald", fontWeight: 700, fontSize: size, lineHeight: 1.04, color, textAlign: "center",
  textTransform: "uppercase", WebkitTextStroke: `${Math.round(size / 28)}px #000`, paintOrder: "stroke fill",
  textShadow: "0 8px 0 rgba(0,0,0,0.85)",
});

export const CoverText: React.FC<{ c: CoverSpec }> = ({ c }) => {
  const ts = fit(c.top, 170, 960);
  const bs = fit(c.bottom ?? [], 116, 940);
  return (
    <AbsoluteFill>
      {/* затемнение сверху и снизу - текст читается на любом кадре */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,10,22,0.92) 0%, rgba(8,10,22,0.75) 30%, rgba(8,10,22,0) 46%, rgba(8,10,22,0) 62%, rgba(8,10,22,0.8) 74%, rgba(8,10,22,0.95) 100%)" }} />
      <div style={{ position: "absolute", top: 290, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {c.tag ? (
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 60, color: WHITE, background: c.tagColor ?? "#E83430", padding: "8px 34px", borderRadius: 20, marginBottom: 26 }}>
            {c.tag}
          </div>
        ) : null}
        {c.top.map((l, i) => (
          <div key={i} style={txt(ts, i === c.top.length - 1 && c.top.length > 1 ? YEL : WHITE)}>{l}</div>
        ))}
      </div>
      {c.bottom?.length ? (
        <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {c.bottom.map((l, i) => (
            <div key={i} style={txt(bs, i === c.bottom!.length - 1 ? YEL : WHITE)}>{l}</div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
