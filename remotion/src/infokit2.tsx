// Расширенный набор анимаций (18.10.2026: владелец - «все ролики одинаковые, пусть каждый раз меняется»).
// Все элементы в «безопасной зоне»: x 60..1020, y 300..1300 (ниже - субтитры), ничего не обрезается у края.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, GOLD, LANG, RED, tint, WHITE } from "./infokit";
import "./fonts";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const DIM = "rgba(246,242,234,0.35)";
const H1: React.CSSProperties = { fontFamily: "Oswald", fontWeight: 700, color: WHITE, textShadow: "0 8px 30px rgba(0,0,0,0.6)" };
const TXT: React.CSSProperties = { fontFamily: "Montserrat", fontWeight: 700, color: WHITE };

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, t: frame / fps };
};
const pop = (frame: number, fps: number, at: number, damping = 24) => spring({ frame: frame - at * fps, fps, config: { damping: Math.max(damping, 22), stiffness: 120 } });
const Center: React.FC<{ top?: number; children: React.ReactNode }> = ({ top = 330, children }) => (
  <AbsoluteFill style={{ top, alignItems: "center" }}>{children}</AbsoluteFill>
);

/** 1. Одометр: цифры прокручиваются барабанами, как счётчик. */
export const Odometer: React.FC<{ to: number; prefix?: string; suffix?: string; label?: string }> = ({ to, prefix = "", suffix = "", label }) => {
  const { frame, fps } = useT();
  const digits = String(Math.round(to)).split("");
  const H = 260;
  return (
    <Center top={360}>
      <div style={{ display: "flex", alignItems: "center", ...H1, fontSize: 230, color: GOLD }}>
        {prefix}
        {digits.map((d, k) => {
          const p = interpolate(frame, [k * 4, k * 4 + 1.1 * fps], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const roll = (Number(d) + 20) * p; // два полных оборота и остановка на нужной цифре
          return (
            <div key={k} style={{ height: H, overflow: "hidden", width: 150, textAlign: "center" }}>
              <div style={{ translate: `0px ${-(roll % 10) * H}px` }}>
                {Array.from({ length: 11 }, (_, n) => (
                  <div key={n} style={{ height: H, lineHeight: `${H}px` }}>{n % 10}</div>
                ))}
              </div>
            </div>
          );
        })}
        {suffix}
      </div>
      {label ? <div style={{ ...H1, fontSize: 76, marginTop: 10, opacity: interpolate(frame, [0.6 * fps, 0.9 * fps], [0, 1], clamp) }}>{label}</div> : null}
    </Center>
  );
};

/** 2. Кольцо прогресса: окружность заполняется до процента, в центре число. */
export const Ring: React.FC<{ pct: number; label: string; bad?: boolean }> = ({ pct, label, bad }) => {
  const { frame, fps } = useT();
  const k = interpolate(frame, [0.2 * fps, 1.3 * fps], [0, pct / 100], { ...clamp, easing: ease });
  const R = 250;
  const C = 2 * Math.PI * R;
  const col = bad ? RED : GOLD;
  return (
    <Center top={300}>
      <svg width={640} height={640}>
        <circle cx={320} cy={320} r={R} fill="none" stroke="rgba(246,242,234,0.1)" strokeWidth={44} />
        <circle cx={320} cy={320} r={R} fill="none" stroke={col} strokeWidth={44} strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, C * k)} ${C}`} transform="rotate(-90 320 320)" style={{ filter: `drop-shadow(0 0 18px ${col}88)` }} />
      </svg>
      <div style={{ position: "absolute", top: 210, width: "100%", textAlign: "center", ...H1, fontSize: 170, color: col }}>{Math.round(k * 100)}%</div>
      <div style={{ ...TXT, fontSize: 50, marginTop: 10, textAlign: "center", maxWidth: 900 }}>{label}</div>
    </Center>
  );
};

/** 3. Спидометр: стрелка уходит в зону «низко / высоко». value 0..1. */
export const Gauge: React.FC<{ value: number; label: string; low?: string; high?: string }> = ({ value, label, low = LANG === "en" ? "LOW" : "МАЛО", high = LANG === "en" ? "HIGH" : "МНОГО" }) => {
  const { frame, fps } = useT();
  const v = interpolate(frame, [0.2 * fps, 1.2 * fps], [0, value], { ...clamp, easing: ease });
  const ang = -90 + 180 * v;
  const arc = (a0: number, a1: number, col: string) => {
    const r = 300;
    const p = (a: number) => [540 + r * Math.cos(((a - 180) * Math.PI) / 180), 760 + r * Math.sin(((a - 180) * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return <path d={`M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`} stroke={col} strokeWidth={46} fill="none" />;
  };
  return (
    <AbsoluteFill>
      <svg width={1080} height={1200} style={{ position: "absolute" }}>
        {arc(2, 60, RED)}
        {arc(62, 118, "#8A8478")}
        {arc(120, 178, GOLD)}
        <g transform={`rotate(${ang} 540 760)`}>
          <line x1={540} y1={760} x2={540} y2={500} stroke={WHITE} strokeWidth={14} strokeLinecap="round" />
        </g>
        <circle cx={540} cy={760} r={30} fill={WHITE} />
      </svg>
      <div style={{ position: "absolute", top: 800, left: 180, ...TXT, fontSize: 38, color: RED }}>{low}</div>
      <div style={{ position: "absolute", top: 800, right: 180, ...TXT, fontSize: 38, color: GOLD }}>{high}</div>
      <div style={{ position: "absolute", top: 330, width: "100%", textAlign: "center", ...H1, fontSize: 80 }}>{label}</div>
    </AbsoluteFill>
  );
};

/** 4. Столбики: вертикальные колонки растут, хорошая - золотая и самая высокая. */
export const Columns: React.FC<{ items: { label: string; h: number; good?: boolean }[]; title?: string }> = ({ items, title }) => {
  const { frame, fps } = useT();
  const w = Math.min(220, 820 / items.length - 30);
  return (
    <AbsoluteFill>
      {title ? <div style={{ position: "absolute", top: 320, width: "100%", textAlign: "center", ...H1, fontSize: 78 }}>{title}</div> : null}
      <div style={{ position: "absolute", left: 130, right: 130, bottom: 1920 - 1180, height: 620, display: "flex", alignItems: "flex-end", justifyContent: "space-around" }}>
        {items.map((it, k) => {
          const g = interpolate(frame, [(0.3 + k * 0.35) * fps, (0.9 + k * 0.35) * fps], [0, it.h], { ...clamp, easing: ease });
          return (
            <div key={k} style={{ width: w, textAlign: "center" }}>
              <div style={{ height: 560 * g, borderRadius: "16px 16px 0 0", background: it.good ? GOLD : DIM, boxShadow: it.good ? `0 0 40px ${GOLD}66` : "none" }} />
              <div style={{ ...TXT, fontSize: 34, marginTop: 14, color: it.good ? GOLD : WHITE }}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 5. Противостояние: две карточки одна под другой (плохое сверху, хорошее снизу), между ними тонкое «VS».
 * Широкие карточки - слова всегда помещаются; появление плавное, без подскоков. */
export const Versus: React.FC<{ left: string; right: string; leftSub?: string; rightSub?: string }> = ({ left, right, leftSub, rightSub }) => {
  const { frame, fps } = useT();
  const a = interpolate(frame, [0, 0.6 * fps], [0, 1], { ...clamp, easing: ease });
  const b = interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], { ...clamp, easing: ease });
  const card = (title: string, sub: string | undefined, col: string, k: number) => (
    <div style={{ width: 880, padding: "34px 40px", borderRadius: 28, background: "rgba(12,11,10,0.55)", border: `2px solid ${col}66`,
      textAlign: "center", opacity: k, translate: `0px ${(1 - k) * 30}px` }}>
      <div style={{ ...H1, fontSize: title.length > 14 ? 64 : 80, color: col, lineHeight: 1.05 }}>{title}</div>
      {sub ? <div style={{ ...TXT, fontWeight: 600, fontSize: 38, marginTop: 12, opacity: 0.8 }}>{sub}</div> : null}
    </div>
  );
  return (
    <Center top={400}>
      {card(left, leftSub, "#E07A70", a)}
      <div style={{ ...TXT, fontSize: 40, letterSpacing: 10, color: "rgba(246,242,234,0.6)", margin: "26px 0", opacity: b }}>{LANG === "en" ? "VS" : "ПРОТИВ"}</div>
      {card(right, rightSub, GOLD, b)}
    </Center>
  );
};

/** 6. Чек-лист: пункты появляются с галочкой или крестиком. */
export const Checklist: React.FC<{ title?: string; items: { text: string; ok: boolean }[]; dur: number }> = ({ title, items, dur }) => {
  const { frame, fps } = useT();
  return (
    <AbsoluteFill style={{ padding: "330px 90px 0", alignItems: "center" }}>
      {title ? <div style={{ ...H1, fontSize: 80, marginBottom: 30, textAlign: "center" }}>{title}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: 900 }}>
      {items.map((it, k) => {
        const at = 0.3 + (k * Math.max(0.8, dur - 1.2)) / items.length;
        const s = pop(frame, fps, at);
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 34, opacity: s, translate: `${(1 - s) * 60}px 0px` }}>
            <div style={{ width: 84, height: 84, borderRadius: 20, background: it.ok ? GOLD : "transparent", border: `5px solid ${it.ok ? GOLD : RED}`,
              display: "flex", alignItems: "center", justifyContent: "center", ...TXT, fontSize: 58, color: it.ok ? "#111" : RED }}>{it.ok ? "✓" : "✕"}</div>
            <div style={{ ...TXT, fontSize: 52, color: it.ok ? WHITE : DIM, textDecoration: it.ok ? "none" : "line-through", textDecorationColor: RED }}>{it.text}</div>
          </div>
        );
      })}
      </div>
    </AbsoluteFill>
  );
};

/** 7. Чек из магазина: печатается построчно, внизу ИТОГ (без выдуманных сумм - только подписи). */
export const Receipt: React.FC<{ title: string; items: string[]; total: string; dur: number }> = ({ title, items, total, dur }) => {
  const { frame, fps } = useT();
  const shown = interpolate(frame, [0.3 * fps, Math.max(0.8, dur - 1.0) * fps], [0, items.length + 1], clamp);
  const k = interpolate(frame, [0, 0.4 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <Center top={320}>
      <div style={{ width: 640, background: "#F3EEE2", color: "#1A1714", padding: "40px 46px 60px", boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
        clipPath: "polygon(0 0,100% 0,100% 96%,95% 100%,90% 96%,85% 100%,80% 96%,75% 100%,70% 96%,65% 100%,60% 96%,55% 100%,50% 96%,45% 100%,40% 96%,35% 100%,30% 96%,25% 100%,20% 96%,15% 100%,10% 96%,5% 100%,0 96%)",
        translate: `0px ${(1 - k) * -300}px`, opacity: k }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 56, textAlign: "center", letterSpacing: 4 }}>{title}</div>
        <div style={{ borderTop: "3px dashed #1A1714", margin: "20px 0" }} />
        {items.map((it, i) => (
          <div key={i} style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 40, margin: "12px 0", opacity: shown > i ? 1 : 0, display: "flex", justifyContent: "space-between" }}>
            <span>{it}</span><span>· · ·</span>
          </div>
        ))}
        <div style={{ borderTop: "3px dashed #1A1714", margin: "20px 0", opacity: shown > items.length ? 1 : 0 }} />
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 64, color: RED, textAlign: "center", opacity: shown > items.length ? 1 : 0 }}>{total}</div>
      </div>
    </Center>
  );
};

/** 8. Уведомление на телефоне: выезжает карточка (банк, напоминание). */
export const Notify: React.FC<{ app: string; text: string; bad?: boolean }> = ({ app, text, bad }) => {
  const { frame, fps } = useT();
  const s = pop(frame, fps, 0.2, 14);
  return (
    <Center top={420}>
      <div style={{ width: 900, borderRadius: 40, background: "rgba(30,28,26,0.92)", border: "2px solid rgba(255,255,255,0.12)", padding: "34px 40px",
        boxShadow: "0 30px 70px rgba(0,0,0,0.7)", translate: `0px ${(1 - s) * -500}px`, opacity: s, display: "flex", gap: 30, alignItems: "center" }}>
        <div style={{ width: 110, height: 110, borderRadius: 28, background: bad ? RED : GOLD, display: "flex", alignItems: "center", justifyContent: "center", ...H1, fontSize: 60, color: "#111" }}>
          {bad ? "!" : "$"}
        </div>
        <div>
          <div style={{ ...TXT, fontSize: 34, opacity: 0.6, letterSpacing: 2 }}>{app} · {LANG === "en" ? "now" : "сейчас"}</div>
          <div style={{ ...TXT, fontSize: 48, marginTop: 8, color: bad ? "#FF8A80" : WHITE, lineHeight: 1.2 }}>{text}</div>
        </div>
      </div>
    </Center>
  );
};

/** 9. Весы: чаша с тяжёлым перевешивает. */
export const Scale: React.FC<{ left: string; right: string; heavier: "left" | "right" }> = ({ left, right, heavier }) => {
  const { frame, fps } = useT();
  const tilt = interpolate(frame, [0.4 * fps, 1.4 * fps], [0, heavier === "left" ? -14 : 14], { ...clamp, easing: ease });
  const rad = (tilt * Math.PI) / 180;
  const pan = (dir: number, text: string, good: boolean) => {
    const x = 540 + dir * 290 * Math.cos(rad);
    const y = 560 + dir * 290 * Math.sin(rad);
    return (
      <div style={{ position: "absolute", left: x - 170, top: y + 40, width: 340, textAlign: "center" }}>
        <div style={{ height: 6, background: WHITE, opacity: 0.6, margin: "0 40px" }} />
        <div style={{ margin: "0 auto", width: 300, height: 120, borderRadius: "0 0 150px 150px", background: good ? GOLD : DIM, display: "flex", alignItems: "center", justifyContent: "center",
          ...H1, fontSize: text.length > 9 ? 38 : text.length > 6 ? 44 : 50, color: good ? "#111" : WHITE, padding: "0 16px", lineHeight: 1.05, textShadow: "none" }}>{text}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 535, top: 560, width: 10, height: 520, background: WHITE, opacity: 0.7 }} />
      <div style={{ position: "absolute", left: 250, top: 556, width: 580, height: 10, background: WHITE, rotate: `${tilt}deg` }} />
      <div style={{ position: "absolute", left: 470, top: 1060, width: 140, height: 24, borderRadius: 12, background: WHITE, opacity: 0.7 }} />
      {pan(-1, left, heavier === "left")}
      {pan(1, right, heavier === "right")}
    </AbsoluteFill>
  );
};

/** 10. Сетка 10x10: закрашивается процент клеток (число - только из текста). */
export const Waffle: React.FC<{ pct: number; label: string; bad?: boolean }> = ({ pct, label, bad }) => {
  const { frame, fps } = useT();
  const n = Math.round(interpolate(frame, [0.2 * fps, 1.4 * fps], [0, pct], { ...clamp, easing: ease }));
  return (
    <Center top={330}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 64px)", gap: 10 }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div key={i} style={{ width: 64, height: 64, borderRadius: 12, background: i < n ? (bad ? RED : GOLD) : "rgba(246,242,234,0.1)" }} />
        ))}
      </div>
      <div style={{ ...H1, fontSize: 70, marginTop: 30, color: bad ? RED : GOLD }}>{n}% <span style={{ color: WHITE }}>{label}</span></div>
    </Center>
  );
};

/** 11. Календарь: листы перелистываются до нужного дня/года. */
export const Calendar: React.FC<{ to: number; label: string }> = ({ to, label }) => {
  const { frame, fps } = useT();
  const n = Math.max(1, Math.round(interpolate(frame, [0.2 * fps, 1.3 * fps], [1, to], { ...clamp, easing: Easing.out(Easing.cubic) })));
  const flip = (frame % 4) / 4;
  return (
    <Center top={360}>
      <div style={{ width: 520, borderRadius: 30, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ height: 110, background: RED, display: "flex", alignItems: "center", justifyContent: "center", ...H1, fontSize: 56 }}>{label}</div>
        <div style={{ height: 420, background: "#F3EEE2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Oswald", fontWeight: 700, fontSize: 280, color: "#1A1714",
          rotate: n < to ? `${flip * 6 - 3}deg` : "0deg" }}>{n}</div>
      </div>
    </Center>
  );
};

/** 12. Лестница: ступени появляются снизу вверх, метка поднимается на верх. */
export const Stairs: React.FC<{ steps: string[]; dur: number }> = ({ steps, dur }) => {
  const { frame, fps } = useT();
  const n = steps.length;
  const w = 820 / n;
  return (
    <AbsoluteFill>
      {steps.map((s, k) => {
        const at = 0.2 + (k * Math.max(0.8, dur - 1.2)) / n;
        const p = pop(frame, fps, at, 14);
        const h = 140 + k * (520 / Math.max(1, n - 1));
        const last = k === n - 1;
        return (
          <div key={k} style={{ position: "absolute", left: 130 + k * w, top: 1180 - h, width: w - 12, height: h, background: last ? GOLD : "rgba(246,242,234,0.16)",
            borderTop: `6px solid ${last ? GOLD : WHITE}`, opacity: p, translate: `0px ${(1 - p) * 120}px`, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div style={{ ...H1, fontSize: Math.min(46, 360 / Math.max(4, s.length) + 14), color: last ? "#111" : WHITE, marginTop: 20, textAlign: "center", padding: "0 8px", textShadow: "none" }}>{s}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 13. Стопка монет растёт. */
export const CoinStack: React.FC<{ label: string; n?: number }> = ({ label, n = 12 }) => {
  const { frame, fps } = useT();
  return (
    <AbsoluteFill>
      {Array.from({ length: n }, (_, k) => {
        const s = spring({ frame: frame - k * 3, fps, config: { damping: 14, stiffness: 160 } });
        return (
          <div key={k} style={{ position: "absolute", left: 410 + (k % 2 ? 6 : -6), top: interpolate(s, [0, 1], [-200, 1120 - k * 36]), width: 260, height: 58, borderRadius: "50%",
            background: `linear-gradient(180deg, #F6DC9B 0%, ${GOLD} 45%, #9C7A35 100%)`, border: "3px solid #7A5E25", boxShadow: "0 6px 12px rgba(0,0,0,0.5)" }} />
        );
      })}
      <div style={{ position: "absolute", top: 340, width: "100%", textAlign: "center", ...H1, fontSize: 100, opacity: interpolate(frame, [0.3 * fps, 0.6 * fps], [0, 1], clamp) }}>{label}</div>
    </AbsoluteFill>
  );
};

/** 14. Печатная машинка: заголовок печатается по буквам с курсором. */
export const Typewriter: React.FC<{ text: string; gold?: boolean }> = ({ text, gold }) => {
  const { frame, fps } = useT();
  const n = Math.floor(interpolate(frame, [0, Math.min(1.4, 0.05 * text.length) * fps], [0, text.length], clamp));
  return (
    <Center top={560}>
      <div style={{ ...H1, fontSize: text.length > 20 ? 96 : 124, color: gold ? GOLD : WHITE, maxWidth: 940, textAlign: "center", lineHeight: 1.05 }}>
        {text.slice(0, n)}
        {/* курсор мигает только пока печатается, потом исчезает - иначе выглядит как лишняя черта */}
        <span style={{ opacity: n >= text.length && frame > (Math.min(1.4, 0.05 * text.length) + 0.4) * fps ? 0 : Math.floor(frame / 8) % 2 ? 0 : 1, color: GOLD }}>|</span>
      </div>
    </Center>
  );
};

/** 15. Маркер: фраза, ключевое слово плавно становится золотым и под ним проезжает тонкая линия.
 * Слово всегда читается (никакого тёмного текста на половинчатой плашке). */
export const Marker: React.FC<{ text: string; mark: string }> = ({ text, mark }) => {
  const { frame, fps } = useT();
  const k = interpolate(frame, [0, 0.5 * fps], [0, 1], { ...clamp, easing: ease });
  const m = interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], { ...clamp, easing: ease });
  const words = text.split(" ");
  const marks = mark.toLowerCase().split(" ").map((x) => x.replace(/[.,!?«»]/g, ""));
  return (
    <Center top={540}>
      <div style={{ ...H1, fontSize: 96, maxWidth: 920, textAlign: "center", lineHeight: 1.25, opacity: k, translate: `0px ${(1 - k) * 20}px` }}>
        {words.map((w, i) => {
          const hit = marks.includes(w.toLowerCase().replace(/[.,!?«»]/g, ""));
          return (
            <span key={i} style={{ position: "relative", margin: "0 12px", display: "inline-block", color: hit ? tint(0.35 + 0.65 * m) : WHITE }}>
              {w}
              {hit ? <span style={{ position: "absolute", left: 0, bottom: -4, height: 6, borderRadius: 3, width: `${m * 100}%`, background: GOLD }} /> : null}
            </span>
          );
        })}
      </div>
    </Center>
  );
};

/** 16. Штамп: печать мягко «опускается» (без резкого удара), полупрозрачная, как чернила. */
export const Stamp: React.FC<{ text: string }> = ({ text }) => {
  const { frame, fps } = useT();
  const k = interpolate(frame, [0.1 * fps, 0.6 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <Center top={620}>
      <div style={{ border: `8px solid #C9453C`, borderRadius: 16, padding: "14px 40px", color: "#C9453C", ...H1, textShadow: "none", fontSize: text.length > 12 ? 88 : 116,
        letterSpacing: 6, rotate: "-6deg", scale: interpolate(k, [0, 1], [1.25, 1]), opacity: 0.85 * k }}>{text}</div>
    </Center>
  );
};

/** 17. Слова стопкой: слова плавно проявляются одно под другим, последнее - золотом. */
export const WordStack: React.FC<{ words: string[]; dur: number }> = ({ words, dur }) => {
  const { frame, fps } = useT();
  return (
    <Center top={380}>
      {words.map((w, k) => {
        const at = 0.15 + (k * Math.max(0.6, dur - 1)) / words.length;
        const s = interpolate(frame, [at * fps, (at + 0.45) * fps], [0, 1], { ...clamp, easing: ease });
        return (
          <div key={k} style={{ ...H1, fontSize: 120, lineHeight: 1.08, color: k === words.length - 1 ? GOLD : WHITE, opacity: s, translate: `0px ${(1 - s) * 24}px` }}>{w}</div>
        );
      })}
    </Center>
  );
};

/** 18. Цитата: огромные кавычки, текст и автор. */
export const QuoteCard: React.FC<{ text: string; author?: string }> = ({ text, author }) => {
  const { frame, fps } = useT();
  const k = interpolate(frame, [0, 0.5 * fps], [0, 1], { ...clamp, easing: ease });
  return (
    <Center top={380}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 300, color: GOLD, lineHeight: 0.6, opacity: k }}>“</div>
      <div style={{ ...H1, fontSize: text.length > 40 ? 70 : 88, maxWidth: 900, textAlign: "center", lineHeight: 1.15, opacity: k, translate: `0px ${(1 - k) * 30}px` }}>{text}</div>
      {author ? <div style={{ ...TXT, fontSize: 40, color: GOLD, marginTop: 30, opacity: interpolate(frame, [0.7 * fps, 1 * fps], [0, 1], clamp) }}>- {author}</div> : null}
    </Center>
  );
};
