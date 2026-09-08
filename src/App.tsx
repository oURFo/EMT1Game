import { useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { simulationScenarios } from "./data/simulationScenarios";
import { DIFFICULTIES } from "./game/engine";
import {
  advanceWithoutAction,
  assessCriticalCase,
  createSimulationState,
  getGcsDisplay,
  performSimulationAction,
  summarizeOutcome,
} from "./game/simulationEngine";
import type {
  ProcedureResolution,
  SimulationAction,
  SimulationScenario,
  SimulationState,
} from "./game/types";

type Screen = "home" | "briefing" | "game" | "debrief";
type Result = ReturnType<typeof summarizeOutcome>;

interface SavedProgress {
  bestScore: number;
  shiftsCompleted: number;
  soundEnabled: boolean;
}

const defaultProgress: SavedProgress = {
  bestScore: 0,
  shiftsCompleted: 0,
  soundEnabled: false,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [deck, setDeck] = useState<SimulationScenario[]>([]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [caseState, setCaseState] = useState<SimulationState | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(() => loadProgress());

  const difficulty = DIFFICULTIES.standard;
  const currentScenario = deck[caseIndex];
  const currentResult = results[results.length - 1];
  const criticalAssessment =
    currentScenario && caseState
      ? assessCriticalCase(currentScenario, caseState)
      : null;

  useEffect(() => {
    localStorage.setItem("emt-golden-rescue", JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (screen !== "game" || !currentScenario) return;
    const timer = window.setInterval(() => {
      setCaseState((current) =>
        current
          ? advanceWithoutAction(
              currentScenario,
              current,
              1,
              difficulty,
              false,
            )
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, currentScenario, difficulty]);

  function startShift() {
    setDeck(shuffle([...simulationScenarios]).slice(0, 1));
    setCaseIndex(0);
    setResults([]);
    setCaseState(null);
    setScreen("briefing");
  }

  function enterScene() {
    setCaseState(createSimulationState(currentScenario));
    setScreen("game");
  }

  function applyAction(
    action: SimulationAction,
    resolution?: ProcedureResolution,
  ) {
    if (!currentScenario || !caseState) return;
    const next = performSimulationAction(
      currentScenario,
      caseState,
      action,
      difficulty,
      resolution,
    );
    setCaseState(next);
    playClick(progress.soundEnabled);
    if (next.status === "transported") {
      setResults((items) => [...items, summarizeOutcome(currentScenario, next)]);
      setScreen("debrief");
      playTone(progress.soundEnabled);
    }
  }

  function waitAndObserve() {
    if (!currentScenario || !caseState) return;
    setCaseState(
      advanceWithoutAction(currentScenario, caseState, 30, difficulty),
    );
  }

  function finishCase() {
    const score = currentResult?.score ?? 0;
    setProgress((saved) => ({
      ...saved,
      bestScore: Math.max(saved.bestScore, score),
      shiftsCompleted: saved.shiftsCompleted + 1,
    }));
    returnHome();
  }

  function returnHome() {
    setScreen("home");
    setDeck([]);
    setResults([]);
    setCaseState(null);
  }

  if (screen === "home") {
    return (
      <div className="shell home-shell">
        <nav className="top-nav">
          <span className="brand-mark">EMT//SIM</span>
          <button
            className="sound-toggle"
            onClick={() =>
              setProgress((saved) => ({
                ...saved,
                soundEnabled: !saved.soundEnabled,
              }))
            }
          >
            音效 {progress.soundEnabled ? "開" : "關"}
          </button>
        </nav>
        <main className="hero">
          <div className="hero-copy">
            <span className="eyebrow">DYNAMIC PATIENT SIMULATION</span>
            <h1>EMT<br /><em>黃金救援</em></h1>
            <p>資訊不會自動出現。觀察、選擇儀器、追蹤變化，在病況持續演變時做出取捨。</p>
            <div className="record-strip">
              <span>完成案件 {progress.shiftsCompleted}</span>
              <span>最佳紀錄 {progress.bestScore}</span>
              <span>動態案例 {simulationScenarios.length}</span>
            </div>
          </div>
          <section className="start-card panel">
            <div><span className="eyebrow">START DUTY</span><h2>準備開始值勤</h2></div>
            <p className="single-mode-copy">時間會持續流動；思考、閒置與技術操作都會影響病患狀態。</p>
            <button className="primary-button" onClick={startShift}>開始值勤</button>
            <small className="disclaimer">本作為教育模擬，不取代正式訓練、醫療指示或勤務規範。</small>
          </section>
        </main>
      </div>
    );
  }

  if (!currentScenario) return null;

  if (screen === "briefing") {
    return (
      <div className="shell centered-shell">
        <main className="dispatch-card panel">
          <div className="dispatch-pulse" />
          <span className="eyebrow">INCOMING DISPATCH · {currentScenario.callSign}</span>
          <h1>{currentScenario.title}</h1>
          <p className="dispatch-copy">{currentScenario.dispatch}</p>
          <dl>
            <div><dt>派遣地點</dt><dd>{currentScenario.environment.location}</dd></div>
            <div><dt>案件</dt><dd>{caseIndex + 1} / {deck.length}</dd></div>
            <div><dt>計時</dt><dd>自然時間＋動作耗時</dd></div>
          </dl>
          <div className="tutorial-note">
            <strong>模擬規則</strong>
            <p>時間每秒持續增加，所有動作也會追加操作耗時。只有觀察或使用對應儀器後才會取得資訊；舊讀值需重新量測。</p>
          </div>
          <button className="primary-button" onClick={enterScene}>抵達現場</button>
        </main>
      </div>
    );
  }

  if (screen === "game" && caseState) {
    return (
      <div className="shell">
        <GameScreen
          caseNumber={caseIndex + 1}
          difficulty={difficulty}
          onAction={applyAction}
          onWait={waitAndObserve}
          scenario={currentScenario}
          state={caseState}
          totalCases={deck.length}
        />
      </div>
    );
  }

  if (screen === "debrief" && currentResult) {
    return (
      <div className="shell centered-shell">
        <main className="debrief panel">
          <div className={`grade grade-${currentResult.grade}`}>{currentResult.grade}</div>
          <span className="eyebrow">CASE DEBRIEF</span>
          <h1>{currentScenario.title}</h1>
          <p className="outcome-copy">{currentResult.outcome}</p>
          <div className="score-row">
            <div><strong>{currentResult.score}</strong><span>案例得分</span></div>
            <div><strong>{currentResult.stability}</strong><span>送醫病況</span></div>
            <div><strong>{formatTime(currentResult.elapsed)}</strong><span>現場時間</span></div>
          </div>
          <div className="decision-stats">
            <span>建議動作 {currentResult.bestChoices}</span>
            <span>危險後果 {currentResult.dangerousChoices}</span>
          </div>
          <section className="report-comparison">
            <h2>危急判定對照</h2>
            <div className="comparison-grid">
              <article>
                <span className="comparison-label">系統傷病患資料</span>
                <div className={`critical-classification classification-${criticalAssessment?.classification === "未達危急門檻" ? "normal" : "urgent"}`}>
                  <span>救護員危急個案判定</span>
                  <strong>{criticalAssessment?.classification}</strong>
                </div>
                <h3>符合的判定標準</h3>
                {criticalAssessment?.criteria.length ? (
                  <div className="critical-criteria-list">
                    {criticalAssessment.criteria.map((criterion) => (
                      <div key={`${criterion.category}-${criterion.standard}`}>
                        <span>{criterion.category}</span>
                        <strong>{criterion.standard}</strong>
                        <p>{criterion.evidence}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>病程中未出現跨越危急個案門檻的客觀數值。</p>
                )}
                <h3>為什麼需要送醫</h3>
                <p className="urgent-reason">{criticalAssessment?.urgentReason}</p>
                <ul>
                  {currentScenario.criticalFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
                <div className="gcs-comparison">
                  <span>送醫時實際 GCS</span>
                  <strong>
                    {caseState
                      ? getGcsDisplay(caseState.physiology.consciousness)
                      : "無資料"}
                  </strong>
                </div>
              </article>
              <article>
                <span className="comparison-label">玩家紀錄</span>
                <h3>填寫的危急個案原因</h3>
                <p>
                  {caseState?.playerReport.transportReason ||
                    "玩家未填寫送醫原因"}
                </p>
                <div className="gcs-comparison">
                  <span>玩家 GCS 評分</span>
                  <strong>
                    {caseState?.playerReport.gcs
                      ? `E${caseState.playerReport.gcs.eye} V${caseState.playerReport.gcs.verbal} M${caseState.playerReport.gcs.motor}＝${caseState.playerReport.gcs.total}`
                      : "未執行／未提交 GCS"}
                  </strong>
                </div>
              </article>
            </div>
          </section>
          <ul className="learning-list">
            {currentScenario.learningPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>
          <button className="primary-button" onClick={finishCase}>返回主介面</button>
        </main>
      </div>
    );
  }

  return null;
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem("emt-golden-rescue");
    return raw ? { ...defaultProgress, ...JSON.parse(raw) } : defaultProgress;
  } catch {
    return defaultProgress;
  }
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function playClick(enabled: boolean) {
  if (enabled) playFrequency(520, 0.035);
}

function playTone(enabled: boolean) {
  if (enabled) playFrequency(720, 0.09);
}

function playFrequency(frequency: number, duration: number) {
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.025;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}
