// Витрина всех анимаций: по 3 секунды каждая, с номером и названием - чтобы владелец выбрал, что оставить.
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Attempts, Bars, BigCounter, Donut, Drain, GOLD, InfoBG, LineChart, RED, Steps, Tiles, Title } from "./infokit";
import { Calendar, Checklist, CoinStack, Columns, Gauge, Marker, Notify, Odometer, QuoteCard, Receipt, Ring, Scale, Stamp, Stairs,
  Typewriter, Versus, Waffle, WordStack } from "./infokit2";

const D = 3.2;
const ITEMS: [string, React.ReactNode][] = [
  ["Счётчик", <BigCounter to={480} prefix="$" label="МИЛЛИОНОВ" top={360} />],
  ["Одометр (барабаны)", <Odometer to={1870} label="ГОД" />],
  ["Кольцо процентов", <Ring pct={10} label="СНАЧАЛА ЗАПЛАТИ СЕБЕ" />],
  ["Спидометр", <Gauge value={0.15} label="ТВОЯ ПОДУШКА" low="ПУСТО" high="ЗАПАС" />],
  ["Сетка 10×10", <Waffle pct={10} label="ОТЛОЖИТЬ СЕБЕ" />],
  ["Календарь", <Calendar to={14} label="ДЕНЬ" />],
  ["Заголовок", <Title text="УРОК НА ВСЮ ЖИЗНЬ" top={560} size={124} color={GOLD} />],
  ["Печатная машинка", <Typewriter text="ДЕНЬГИ ЛЮБЯТ ТИШИНУ" gold />],
  ["Маркер", <Marker text="Богатство начинается с учёта" mark="учёта" />],
  ["Штамп", <Stamp text="ЛОВУШКА" />],
  ["Слова стопкой", <WordStack words={["НЕ ДОХОД.", "НЕ УДАЧА.", "ХАРАКТЕР."]} dur={D} />],
  ["Цитата", <QuoteCard text="Беден не тот, у кого мало, а тот, кто хочет большего." author="Сенека" />],
  ["Сравнение полосками", <Bars title="ЧТО ЛЮБЯТ ДЕНЬГИ" items={[{ label: "Спешка", w: 330, color: "rgba(246,242,234,0.35)", strike: true, at: 0.3 }, { label: "Терпение", w: 860, color: GOLD, at: 1.4 }]} />],
  ["Столбики", <Columns title="КУДА УХОДИТ ЗАРПЛАТА" items={[{ label: "Жильё", h: 0.7 }, { label: "Еда", h: 0.5 }, { label: "Доставка", h: 0.4 }, { label: "Себе", h: 0.15, good: true }]} />],
  ["Противостояние VS", <Versus left="ЗАРПЛАТА" leftSub="тратить всё" right="КАПИТАЛ" rightSub="платить себе" />],
  ["Весы", <Scale left="ПОНТЫ" right="СВОБОДА" heavier="right" />],
  ["График", <LineChart pts={[[0, 0.45], [0.12, 0.5], [0.25, 0.22], [0.4, 0.4], [0.6, 0.58], [0.8, 0.8], [1, 1.04]]} drawTo={[{ at: 1.2, upto: 3 }, { at: 2.6, upto: 7 }]} marks={[{ i: 2, text: "СТРАХ", color: RED, at: 1.1 }, { i: 6, text: "РЕЗУЛЬТАТ", color: GOLD, at: 2.5 }]} hot={2} />],
  ["Круговая диаграмма", <Donut segs={[{ label: "Жильё", v: 3, color: "#8A8478", at: 0.1 }, { label: "Еда", v: 2, color: "#ABA496", at: 0.5 }, { label: "Доставка", v: 1.3, color: RED, at: 1.0 }, { label: "Эмоции", v: 1.5, color: "#E2584D", at: 1.5, pulse: true }]} center="УТЕЧКА" centerAt={2.2} />],
  ["Тающая полоска", <Drain label="ЗАРПЛАТА" dur={D} />],
  ["Чек-лист", <Checklist title="ДЕНЬ БОГАТОГО" items={[{ text: "Записал траты", ok: true }, { text: "Отложил 10%", ok: true }, { text: "Купил на эмоциях", ok: false }]} dur={D} />],
  ["Чек из магазина", <Receipt title="ТВОЙ МЕСЯЦ" items={["Доставка", "Подписки", "Кофе с собой", "Покупки на эмоциях"]} total="СЕБЕ: 0" dur={D} />],
  ["Уведомление банка", <Notify app="БАНК" text="Списание: автокредит. Снова." bad />],
  ["Попытки ✕ / ✓", <Attempts items={[{ title: "№1", note: "закрылась", ok: false, at: 0.2 }, { title: "№2", note: "ушёл", ok: false, at: 0.9 }, { title: "№3", note: "1903", ok: true, at: 1.6 }]} />],
  ["Ступени", <Steps steps={[{ label: "ФАБРИКА", at: 0.3 }, { label: "ТЕЛЕГРАФ", at: 1.1 }, { label: "СТАЛЬ", at: 1.9, gold: true }]} />],
  ["Лестница", <Stairs steps={["УЧЁТ", "ПОДУШКА", "НАВЫК", "КАПИТАЛ"]} dur={D} />],
  ["Карточки", <Tiles n={3} label="3 АКЦИИ" top={620} />],
  ["Стопка монет", <CoinStack label="КАЖДАЯ МОНЕТА" />],
];
export const SHOWCASE_SECONDS = ITEMS.length * D;

export const Showcase: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <InfoBG id="auto/a024" />
      {ITEMS.map(([name, el], k) => (
        <Sequence key={k} name={name} from={Math.round(k * D * fps)} durationInFrames={Math.round(D * fps)}>
          {el}
          <AbsoluteFill style={{ top: 1480, alignItems: "center" }}>
            <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 54, color: "#111", background: GOLD, borderRadius: 18, padding: "10px 30px" }}>
              {k + 1}. {name}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
