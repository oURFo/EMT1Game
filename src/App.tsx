import { useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { actionById } from "./data/actions";
import { simulationScenarios } from "./data/simulationScenarios";
import { playClickSound, playToneSound } from "./game/audio";
import { DIFFICULTIES } from "./game/difficulties";
import {
  advanceWithoutAction,
  assessCriticalCase,
  createSimulationState,
  getGcsDisplay,
  performSimulationAction,
  summarizeOutcome,
} from "./game/simulationEngine";
import { buildTransportIndicatorOptions } from "./game/transportIndicators";
import type {
  CaseTier,
  ProcedureResolution,
  SimulationAction,
  SimulationScenario,
  SimulationState,
} from "./game/types";

type Screen = "home" | "briefing" | "game" | "debrief";
type Result = ReturnType<typeof summarizeOutcome>;
type TierFilter = CaseTier | "all";

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

const TIER_LABELS: Record<TierFilter, string> = {
  all: "全部案件",
  intro: "入門",
  intermediate: "進階",
  advanced: "專科",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [deck, setDeck] = useState<SimulationScenario[]>([]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [caseState, setCaseState] = useState<SimulationState | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(() => loadProgress());
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const difficulty = DIFFICULTIES.standard;
  const currentScenario = deck[caseIndex];
  const currentResult = results[results.length - 1];
  const criticalAssessment =
    currentScenario && caseState
      ? assessCriticalCase(currentScenario, caseState)
      : null;
  const transportOptions =
    currentScenario && caseState
      ? buildTransportIndicatorOptions(currentScenario, caseState)
      : [];

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
    const pool =
      tierFilter === "all"
        ? simulationScenarios
        : simulationScenarios.filter((item) => item.caseTier === tierFilter);
    setDeck(shuffle([...pool]).slice(0, 1));
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
    playClickSound(progress.soundEnabled);
    if (next.status === "transported" || next.status === "dead") {
      setResults((items) => [...items, summarizeOutcome(currentScenario, next)]);
      setScreen("debrief");
      playToneSound(progress.soundEnabled);
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
            <h1>
              EMT
              <br />
              <em>黃金救援</em>
            </h1>
            <p>
              單案精練模式：每次隨機一件派遣。資訊不會自動出現，時間持續流逝。
            </p>
            <div className="record-strip">
              <span>完成案件 {progress.shiftsCompleted}</span>
              <span>最佳紀錄 {progress.bestScore}</span>
              <span>案例資料庫 {simulationScenarios.length}</span>
            </div>
          </div>
          <section className="start-card panel">
            <div>
              <span className="eyebrow">START DUTY</span>
              <h2>準備開始值勤</h2>
            </div>
            <p className="single-mode-copy">
              選擇難度分級後開始。思考、閒置與技術操作都會影響病患狀態。
            </p>
            <div className="tier-picker" role="group" aria-label="案件分級">
              {(Object.keys(TIER_LABELS) as TierFilter[]).map((tier) => (
                <button
                  className={tierFilter === tier ? "active" : ""}
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  type="button"
                >
                  {TIER_LABELS[tier]}
                  {tier !== "all" && (
                    <small>
                      {
                        simulationScenarios.filter((item) => item.caseTier === tier)
                          .length
                      }{" "}
                      案
                    </small>
                  )}
                </button>
              ))}
            </div>
            <button className="primary-button" onClick={startShift}>
              開始單案值勤
            </button>
            <small className="disclaimer">
              本作為教育模擬，不取代正式訓練、醫療指示或勤務規範。
            </small>
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
          <span className="eyebrow">
            INCOMING DISPATCH · {currentScenario.callSign}
          </span>
          <h1>{currentScenario.title}</h1>
          <p className="dispatch-copy">{currentScenario.dispatch}</p>
          <dl>
            <div>
              <dt>派遣地點</dt>
              <dd>{currentScenario.environment.location}</dd>
            </div>
            <div>
              <dt>分級</dt>
              <dd>{TIER_LABELS[currentScenario.caseTier]}</dd>
            </div>
            <div>
              <dt>計時</dt>
              <dd>自然時間＋動作耗時（操作期間病況仍持續演變）</dd>
            </div>
          </dl>
          <div className="tutorial-note">
            <strong>模擬規則</strong>
            <p>
              時間每秒持續增加。只有觀察或使用對應儀器後才會取得資訊；舊讀值需重新量測。未做場景安全將於結案大幅扣分。
            </p>
          </div>
          <button className="primary-button" onClick={enterScene}>
            抵達現場
          </button>
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
    const selectedIndicators =
      caseState?.playerReport.transportIndicators?.map(
        (id) => transportOptions.find((item) => item.id === id),
      ).filter(Boolean) ?? [];
    const missedLabels = currentResult.missedRecommended
      .map((id) => actionById[id]?.label ?? id)
      .slice(0, 8);

    return (
      <div className="shell centered-shell">
        <main className="debrief panel">
          <div className={`grade grade-${currentResult.grade}`}>
            {currentResult.grade}
          </div>
          <span className="eyebrow">CASE DEBRIEF</span>
          <h1>{currentScenario.title}</h1>
          <p className="outcome-copy">{currentResult.outcome}</p>
          <div className="score-row">
            <div>
              <strong>{currentResult.score}</strong>
              <span>案例得分</span>
            </div>
            <div>
              <strong>{currentResult.stability}</strong>
              <span>送醫病況</span>
            </div>
            <div>
              <strong>{formatTime(currentResult.elapsed)}</strong>
              <span>現場時間</span>
            </div>
          </div>
          <div className="decision-stats">
            <span>建議動作 {currentResult.bestChoices}</span>
            <span>危險後果 {currentResult.dangerousChoices}</span>
            {currentResult.safetyPenalty > 0 && (
              <span className="safety-penalty">
                安全扣分 −{currentResult.safetyPenalty}
              </span>
            )}
          </div>

          {currentResult.safetyWarnings.length > 0 && (
            <section className="debrief-alert safety-alert">
              <h2>場景安全警告</h2>
              <ul>
                {currentResult.safetyWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <p>未依標準完成場景安全，結案已扣除大量分數。</p>
            </section>
          )}

          <section className="debrief-section">
            <h2>流程回顧</h2>
            <ul className="suggestion-list">
              {currentResult.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {missedLabels.length > 0 && (
              <>
                <h3>未完成的建議動作</h3>
                <ul className="missed-actions">
                  {missedLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="report-comparison">
            <h2>危急判定對照</h2>
            <div className="comparison-grid">
              <article>
                <span className="comparison-label">系統傷病患資料</span>
                <div
                  className={`critical-classification classification-${criticalAssessment?.classification === "未達危急門檻" ? "normal" : "urgent"}`}
                >
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
                <h3>勾選的送醫依據</h3>
                {selectedIndicators.length ? (
                  <ul className="transport-indicator-review">
                    {selectedIndicators.map((item) => (
                      <li key={item!.id}>
                        <strong>{item!.label}</strong>
                        <span>{item!.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>未勾選任何客觀資料。</p>
                )}
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
            {currentScenario.learningPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <button className="primary-button" onClick={finishCase}>
            返回主介面
          </button>
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
