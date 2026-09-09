import { useEffect, useState } from "react";
import { actionById, simulationActions } from "../data/actions";
import { ProcedureModal } from "./ProcedureModal";
import {
  getObservation,
  getActionDuration,
  getPatientCondition,
  measurementIsStale,
  RESUSCITATION_ACTION_IDS,
} from "../game/simulationEngine";
import type {
  ActionCategory,
  Difficulty,
  ProcedureResolution,
  SimulationAction,
  SimulationScenario,
  SimulationState,
} from "../game/types";

interface GameScreenProps {
  scenario: SimulationScenario;
  state: SimulationState;
  difficulty: Difficulty;
  caseNumber: number;
  totalCases: number;
  onAction: (action: SimulationAction, resolution?: ProcedureResolution) => void;
  onWait: () => void;
}

const categories: ActionCategory[] = ["安全", "評估", "問診", "處置", "運送"];
const findingKeys = ["appearance", "skin", "airway", "breathing", "injuries", "bleeding", "sampleHistory", "opqrst", "stroke"] as const;
const findingLabels = {
  appearance: "整體外觀",
  skin: "膚色與皮膚",
  airway: "呼吸道",
  breathing: "呼吸觀察",
  injuries: "傷處",
  bleeding: "出血",
  sampleHistory: "SAMPLE 病史",
  opqrst: "OPQRST 症狀分析",
  stroke: "神經學評估",
};

export function GameScreen({
  scenario,
  state,
  difficulty,
  caseNumber,
  totalCases,
  onAction,
  onWait,
}: GameScreenProps) {
  const [activeCategory, setActiveCategory] = useState<ActionCategory>("安全");
  const [procedureAction, setProcedureAction] = useState<SimulationAction | null>(null);
  const [procedureSession, setProcedureSession] = useState(0);
  const condition = getPatientCondition(state.physiology);
  const resuscitationMode = state.status === "arrest";
  const actions = resuscitationMode
    ? RESUSCITATION_ACTION_IDS.map((id) => actionById[id]).filter(Boolean)
    : simulationActions.filter((item) => item.category === activeCategory);
  const latestResult = state.log[0];

  useEffect(() => {
    if (resuscitationMode) {
      setActiveCategory("處置");
    }
  }, [resuscitationMode]);

  return (
    <main className="sim-layout">
      {procedureAction && (
        <ProcedureModal
          action={procedureAction}
          key={`${procedureAction.id}-${procedureSession}`}
          onClose={() => setProcedureAction(null)}
          onComplete={(completedAction, resolution) => {
            setProcedureAction(null);
            onAction(completedAction, resolution);
          }}
          scenario={scenario}
          state={state}
        />
      )}
      {latestResult && (
        <div
          className={`result-toast ${latestResult.tone}`}
          key={latestResult.id}
          role="status"
        >
          <span>動作結果</span>
          <strong>{latestResult.label}</strong>
          <p>{latestResult.message}</p>
        </div>
      )}
      <header className="mission-bar">
        <div>
          <span className="eyebrow">
            CASE {caseNumber}/{totalCases} · {scenario.callSign}
          </span>
          <h1>{scenario.title}</h1>
        </div>
        <div className="mission-metrics">
          <span>{formatTime(state.elapsed)}</span>
          <span>{state.score} 分</span>
        </div>
      </header>

      <section className="environment-strip panel">
        <div><span>地點</span><strong>{scenario.environment.location}</strong></div>
        <div><span>天氣</span><strong>{scenario.environment.weather}</strong></div>
        <div><span>環境溫度</span><strong>{scenario.environment.ambientTemperature} °C</strong></div>
        <div><span>時間</span><strong>{scenario.environment.timeOfDay}</strong></div>
        <div className="hazards"><span>已知危害</span><strong>{scenario.environment.hazards.join(" · ")}</strong></div>
      </section>

      <section className="clinical-board panel">
        <div className="patient-heading">
          <div>
            <span className="eyebrow">PATIENT STATUS</span>
            <h2>{scenario.patient}，{scenario.age} 歲</h2>
            <p>{scenario.chiefComplaint}</p>
          </div>
          <div className={`stability-orb ${condition >= 60 ? "stable" : condition >= 30 ? "warning" : "critical"}`}>
            <strong>{condition}</strong>
            <span>病況指標</span>
          </div>
        </div>

        {resuscitationMode && (
          <div className="critical-alert">
            病患已陷入極危急狀態。請重新確認呼吸與脈搏，並從下方「復甦處置」清單選擇適當處置。
          </div>
        )}

        <div className="monitor-grid">
          <MonitorValue
            label="意識 AVPU"
            value={
              state.completedActionIds.includes("check-response")
                ? consciousnessLabel(state.physiology.consciousness)
                : null
            }
            age={state.elapsed}
            measuredAt={findLogTime(state, "check-response")}
          />
          <MonitorValue label="GCS" measurement={state.measurements.gcs} age={state.elapsed} />
          <MonitorValue label="脈搏" measurement={state.measurements.pulse} age={state.elapsed} />
          <MonitorValue label="呼吸" measurement={state.measurements.respiratoryRate} age={state.elapsed} />
          <MonitorValue label="血壓" measurement={state.measurements.bloodPressure} age={state.elapsed} />
          <MonitorValue label="SpO₂" measurement={state.measurements.spo2} age={state.elapsed} />
          <MonitorValue label="體溫" measurement={state.measurements.temperature} age={state.elapsed} />
          <MonitorValue label="血糖" measurement={state.measurements.glucose} age={state.elapsed} />
        </div>

        <div className="findings">
          <h3>已取得的現場與病患資訊</h3>
          {state.revealed.length === 0 ? (
            <p className="locked-copy">尚未觀察或評估。數值不會自動顯示。</p>
          ) : (
            findingKeys
              .filter((key) => state.revealed.includes(key))
              .map((key) => (
                <article key={key}>
                  <span>{findingLabels[key]}</span>
                  <p>{getObservation(scenario, state, key)}</p>
                </article>
              ))
          )}
        </div>
      </section>

      <section className="toolbox panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">
              {resuscitationMode ? "CARDIAC ARREST PROTOCOL" : "FULL EMT TOOLBOX"}
            </span>
            <h2>{resuscitationMode ? "復甦處置" : "下一個動作"}</h2>
          </div>
          {difficulty.showHints && !resuscitationMode && (
            <span className="hint-chip">每個動作都會消耗時間</span>
          )}
        </div>
        {!resuscitationMode && (
          <div className="category-tabs" role="tablist" aria-label="動作分類">
            {categories.map((category) => (
              <button
                className={activeCategory === category ? "active" : ""}
                key={category}
                onClick={() => setActiveCategory(category)}
                role="tab"
              >
                {category}
              </button>
            ))}
          </div>
        )}
        {!resuscitationMode && (
          <button className="observe-time-button" onClick={onWait}>
            暫不處置，觀察 30 秒病況變化
          </button>
        )}
        {resuscitationMode && (
          <p className="resuscitation-hint">
            危急模式下僅開放再評估與復甦相關處置。完成 CPR／AED 並恢復循環後，即可繼續一般評估與送醫。
          </p>
        )}
        <div className={`sim-action-list${resuscitationMode ? " resuscitation-mode" : ""}`}>
          {actions.map((item) => {
            const completed = !item.repeatable && state.completedActionIds.includes(item.id);
            const duration = getActionDuration(scenario, item);
            const unavailable = state.status === "transported";
            return (
              <button
                className={completed ? "completed" : ""}
                disabled={completed || unavailable}
                key={item.id}
                onClick={() => {
                  if (requiresProcedure(item.id)) {
                    setProcedureSession((session) => session + 1);
                    setProcedureAction(item);
                  } else {
                    onAction(item);
                  }
                }}
              >
                <div>
                  <strong>{completed ? "已執行" : item.label}</strong>
                  <p>{item.description}</p>
                </div>
                <span>{duration} 秒</span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="sim-log panel" aria-live="polite">
        <span className="eyebrow">LIVE CONSEQUENCES</span>
        <h2>病況與處置紀錄</h2>
        {state.log.length === 0 ? (
          <p className="locked-copy">派遣資訊不等於現場真相。先觀察，再決定。</p>
        ) : (
          <ol>
            {state.log.map((entry) => (
              <li className={entry.tone} key={entry.id}>
                <div><strong>{entry.label}</strong><time>{formatTime(entry.elapsed)}</time></div>
                <p>{entry.message}</p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </main>
  );
}

function MonitorValue({
  label,
  measurement,
  value,
  age,
  measuredAt,
}: {
  label: string;
  measurement?: { value: string; measuredAt: number };
  value?: string | null;
  age: number;
  measuredAt?: number;
}) {
  const time = measurement?.measuredAt ?? measuredAt;
  const stale = time !== undefined && age - time >= 90;
  return (
    <div className={`monitor-value ${stale ? "stale" : ""}`}>
      <span>{label}</span>
      <strong>{measurement?.value ?? value ?? "未量測"}</strong>
      <small>
        {time === undefined ? "需評估／使用儀器" : `${formatTime(time)} 取得${stale ? " · 已過期" : ""}`}
      </small>
    </div>
  );
}

function findLogTime(state: SimulationState, actionId: string) {
  return state.log.find((entry) => entry.id.startsWith(actionId))?.elapsed;
}

function consciousnessLabel(value: number) {
  return value >= 85 ? "A－清醒" : value >= 60 ? "V－對聲音" : value >= 25 ? "P－對疼痛" : "U－無反應";
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function requiresProcedure(actionId: string) {
  return actionId.startsWith("transport-") || [
    "gcs-assessment",
    "oxygen",
    "bvm",
    "airway-management",
    "direct-pressure",
    "tourniquet",
    "cpr",
    "aed-analyze",
  ].includes(actionId);
}
