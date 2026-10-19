import { Composition } from "remotion";
import { AutoInfo, AutoProps, calcAuto } from "./AutoInfo";
import { Showcase, SHOWCASE_SECONDS } from "./Showcase";
import { LongInfo, LongProps, calcLong } from "./LongInfo";
import { GimliRecon, ReconProps, calcRecon } from "./GimliRecon";
import { GimliReal } from "./GimliReal";
import { Tsunami, SurvProps, calcSurv } from "./Tsunami";
import { Scenario, ScenarioProps, calcScenario } from "./Scenario";

const sample: AutoProps = {
  id: "sample",
  tag: "ДЕНЬГИ",
  cta: "ТАБЛИЦА УЧЁТА ДЕНЕГ, КАК У РОКФЕЛЛЕРА",
  total: 6,
  segments: [{ text: "Пример", start: 0, end: 3 }],
  words: [["Пример", 0, 1]],
  scenes: [{ type: "title", text: "ПРИМЕР" }],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition id="Showcase" component={Showcase} durationInFrames={Math.round(SHOWCASE_SECONDS * 30)} fps={30} width={1080} height={1920} />
    <Composition
      id="AutoInfo"
      component={AutoInfo}
      durationInFrames={180}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={sample}
      calculateMetadata={calcAuto}
    />
    <Composition
      id="LongInfo"
      component={LongInfo}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ ...sample, chapters: [] } as LongProps}
      calculateMetadata={calcLong}
    />
    <Composition
      id="GimliRecon"
      component={GimliRecon}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ id: "recon_gimli", total: 10, segments: Array.from({ length: 9 }, (_, i) => ({ text: "", start: i, end: i + 1 })), words: [["Test", 0, 1]] } as ReconProps}
      calculateMetadata={calcRecon}
    />
    <Composition
      id="GimliReal"
      component={GimliReal}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ id: "recon_gimli", total: 10, segments: Array.from({ length: 9 }, (_, i) => ({ text: "", start: i, end: i + 1 })), words: [["Test", 0, 1]] } as ReconProps}
      calculateMetadata={calcRecon}
    />
    <Composition
      id="Tsunami"
      component={Tsunami}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ id: "surv_tsunami", total: 10, segments: Array.from({ length: 14 }, (_, i) => ({ text: "", start: i * 0.7, end: i * 0.7 + 0.6 })), words: [["Test", 0, 1]] } as SurvProps}
      calculateMetadata={calcSurv}
    />
    <Composition
      id="Scenario"
      component={Scenario}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ id: "surv_tsunami", total: 10, segments: [{ text: "", start: 0, end: 1 }], words: [["Test", 0, 1]],
        spec: { env: "city", hero: { name: "Sam" }, hazard: { type: "dark", line: 0 }, shots: [{ focus: "hero" }], ending: "TEST" } } as ScenarioProps}
      calculateMetadata={calcScenario}
    />
    </>
  );
};
