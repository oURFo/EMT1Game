import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { actionById } from "../data/actions";
import {
  assessCriticalCase,
  getGcsDisplay,
  getObservation,
  getPatientCondition,
} from "../game/simulationEngine";
import type {
  ProcedureResolution,
  SimulationAction,
  SimulationScenario,
  SimulationState,
} from "../game/types";

const findingKeys = [
  "appearance",
  "skin",
  "airway",
  "breathing",
  "injuries",
  "bleeding",
  "sampleHistory",
  "opqrst",
  "stroke",
] as const;
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
} as const;

interface ProcedureModalProps {
  action: SimulationAction;
  scenario: SimulationScenario;
  state: SimulationState;
  onClose: () => void;
  onComplete: (
    action: SimulationAction,
    resolution: ProcedureResolution,
  ) => void;
}

export function ProcedureModal({
  action,
  scenario,
  state,
  onClose,
  onComplete,
}: ProcedureModalProps) {
  const kind = procedureKind(action.id);
  return (
    <div className="procedure-backdrop" role="dialog" aria-modal="true">
      <section className={`procedure-modal panel${kind === "transport" ? " transport-modal" : ""}`}>
        <header>
          <div>
            <span className="eyebrow">INTERACTIVE PROCEDURE</span>
            <h2>{procedureTitle(kind)}</h2>
          </div>
          <button onClick={onClose} aria-label="關閉操作">×</button>
        </header>
        {kind === "gcs" && (
          <GcsProcedure scenario={scenario} state={state} onComplete={(result) => onComplete(actionById["gcs-assessment"], result)} />
        )}
        {kind === "oxygen" && (
          <OxygenProcedure state={state} onComplete={(result) => onComplete(actionById.oxygen, result)} />
        )}
        {kind === "bvm" && (
          <BvmProcedure scenario={scenario} state={state} onComplete={(result) => onComplete(actionById.bvm, result)} />
        )}
        {kind === "airway" && (
          <AirwayProcedure scenario={scenario} state={state} onComplete={(result) => onComplete(actionById["airway-management"], result)} />
        )}
        {kind === "bleeding" && (
          <BleedingProcedure state={state} onComplete={(selected, result) => onComplete(actionById[selected], result)} />
        )}
        {kind === "cpr" && (
          <CprProcedure state={state} onComplete={(result) => onComplete(actionById.cpr, result)} />
        )}
        {kind === "transport" && (
          <TransportProcedure
            action={action}
            scenario={scenario}
            state={state}
            onComplete={(result) => onComplete(action, result)}
          />
        )}
      </section>
    </div>
  );
}

function GcsProcedure({
  scenario,
  state,
  onComplete,
}: {
  scenario: SimulationScenario;
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const [responses, setResponses] = useState<
    { id: string; section: "E" | "V" | "M"; label: string; response: string; duration: number }[]
  >([]);
  const [eye, setEye] = useState("");
  const [verbal, setVerbal] = useState("");
  const [motor, setMotor] = useState("");
  const actual = useMemo(() => gcsFromConsciousness(state.physiology.consciousness), [state.physiology.consciousness]);
  const computedTotal = useMemo(() => {
    const e = Number(eye);
    const v = Number(verbal);
    const m = Number(motor);
    if (
      e >= 1 &&
      e <= 4 &&
      v >= 1 &&
      v <= 5 &&
      m >= 1 &&
      m <= 6
    ) {
      return e + v + m;
    }
    return null;
  }, [eye, motor, verbal]);

  function perform(
    id: string,
    section: "E" | "V" | "M",
    label: string,
    duration: number,
  ) {
    if (responses.some((item) => item.id === id)) return;
    setResponses((items) => [
      ...items,
      {
        id,
        section,
        label,
        duration,
        response: gcsPatientResponse(id, actual, scenario),
      },
    ]);
  }

  function submit() {
    if (computedTotal === null) return;
    const entered = {
      eye: Number(eye),
      verbal: Number(verbal),
      motor: Number(motor),
      total: computedTotal,
    };
    onComplete({
      duration: 15 + responses.reduce((sum, item) => sum + item.duration, 0),
      scoreModifier: 0,
      message: `GCS 已記錄：E${entered.eye} V${entered.verbal} M${entered.motor}＝${entered.total}。`,
      playerGcs: entered,
    });
  }

  const scoresValid = computedTotal !== null;
  return (
    <div className="procedure-body">
      <p className="procedure-instruction">分別蒐集睜眼、語言及最佳動作反應。畫面只呈現患者行為，不提示對應分數；若高階刺激已有反應，不應再施加疼痛刺激。</p>

      <GcsActionGroup title="E－睜眼反應">
        <button onClick={() => perform("eye-observe", "E", "直接觀察眼睛", 3)}>直接觀察眼睛</button>
        <button onClick={() => perform("eye-normal-call", "E", "一般音量呼叫姓名", 4)}>一般音量呼叫姓名</button>
        <button onClick={() => perform("eye-loud-call", "E", "提高音量要求睜眼", 4)}>提高音量要求睜眼</button>
        <button onClick={() => perform("eye-shoulder", "E", "輕拍肩部並呼叫", 5)}>輕拍肩部並呼叫</button>
        <button onClick={() => perform("eye-pain", "E", "適當疼痛刺激觀察睜眼", 8)}>適當疼痛刺激</button>
      </GcsActionGroup>

      <GcsActionGroup title="V－語言反應">
        <button onClick={() => perform("verbal-name", "V", "詢問姓名", 5)}>你叫什麼名字？</button>
        <button onClick={() => perform("verbal-place", "V", "詢問地點", 5)}>你現在在哪裡？</button>
        <button onClick={() => perform("verbal-time", "V", "詢問年月", 5)}>現在是幾年幾月？</button>
        <button onClick={() => perform("verbal-event", "V", "詢問事件", 5)}>發生了什麼事？</button>
        <button onClick={() => perform("verbal-repeat", "V", "要求重複句子", 6)}>請重複：「我正在接受救護評估」</button>
      </GcsActionGroup>

      <GcsActionGroup title="M－動作反應（左右側分開，採最佳反應）">
        <button onClick={() => perform("motor-left-hand", "M", "左手握緊後放開", 6)}>左手握緊後放開</button>
        <button onClick={() => perform("motor-right-hand", "M", "右手握緊後放開", 6)}>右手握緊後放開</button>
        <button onClick={() => perform("motor-left-leg", "M", "抬起左腳", 6)}>抬起左腳</button>
        <button onClick={() => perform("motor-right-leg", "M", "抬起右腳", 6)}>抬起右腳</button>
        <button onClick={() => perform("motor-fingers", "M", "比出兩根手指", 5)}>比出兩根手指</button>
        <button onClick={() => perform("motor-central-pain", "M", "中央疼痛刺激", 8)}>斜方肌擠壓等中央刺激</button>
        <button onClick={() => perform("motor-peripheral-pain", "M", "周邊疼痛刺激", 8)}>指甲床壓迫等周邊刺激</button>
      </GcsActionGroup>

      <div className="gcs-response-board">
        {responses.length ? (
          responses.map((item) => (
            <article key={item.id}>
              <span>{item.section} · {item.label}</span>
              <p>{item.response}</p>
            </article>
          ))
        ) : (
          <p>尚未執行 GCS 評估動作。</p>
        )}
      </div>

      <div className="score-inputs">
        <NumberInput label="E 睜眼" min={1} max={4} value={eye} onChange={setEye} />
        <NumberInput label="V 語言" min={1} max={5} value={verbal} onChange={setVerbal} />
        <NumberInput label="M 動作" min={1} max={6} value={motor} onChange={setMotor} />
        <div className="total-score">
          <span>GCS 總分</span>
          <strong>{computedTotal ?? "—"}</strong>
        </div>
      </div>
      <p className="gcs-submit-note">
        總分會依 E、V、M 自動加總。評估動作供判斷患者反應使用；完成評分欄位後即可送出。
      </p>
      <SubmitButton
        disabled={!scoresValid}
        onClick={submit}
      />
    </div>
  );
}

function OxygenProcedure({
  state,
  onComplete,
}: {
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const [device, setDevice] = useState("nasal");
  const [flow, setFlow] = useState(4);
  const spo2 = state.physiology.spo2;
  const expected = spo2 < 90 ? "nrb" : spo2 < 94 ? "nasal" : "none";
  const validFlow =
    (device === "nasal" && flow >= 1 && flow <= 6) ||
    (device === "simple" && flow >= 5 && flow <= 10) ||
    (device === "nrb" && flow >= 10 && flow <= 15);
  const labels: Record<string, string> = {
    nasal: "鼻導管",
    simple: "一般氧氣面罩",
    nrb: "非再吸入型面罩",
  };

  function submit() {
    const indicated = expected !== "none";
    const deviceCorrect =
      expected === device || (expected === "nasal" && device === "simple");
    const correct = indicated && deviceCorrect && validFlow;
    const gain = !validFlow ? 0 : device === "nrb" ? 12 : device === "simple" ? 7 : 4;
    onComplete({
      duration: 28,
      scoreModifier: correct ? 22 : -16,
      physiologyDelta: { spo2: gain, oxygenation: gain * 1.5 },
      message: !indicated
        ? `目前 SpO₂ 約 ${Math.round(spo2)}%，未先確認給氧適應症便選擇${labels[device]} ${flow} L/min。`
        : correct
          ? `選擇${labels[device]} ${flow} L/min，裝置與流量符合目前模擬病況；請重新量測 SpO₂。`
          : `${labels[device]}設定 ${flow} L/min 與目前需求或裝置安全流量不符，氧合改善有限。`,
    });
  }

  return (
    <div className="procedure-body">
      <p className="procedure-instruction">依已取得的呼吸評估與 SpO₂ 選擇裝置。遊戲採 EMT-1 訓練用範圍，仍應以所在地勤務規範為準。</p>
      <ChoiceGroup label="給氧裝置" value={device} onChange={setDevice} options={[
        ["nasal", "鼻導管"],
        ["simple", "一般氧氣面罩"],
        ["nrb", "非再吸入型面罩"],
      ]} />
      <RangeInput label="氧氣流量" value={flow} min={1} max={15} suffix="L/min" onChange={setFlow} />
      <SubmitButton onClick={submit} />
    </div>
  );
}

function BvmProcedure({
  state,
  onComplete,
}: {
  scenario: SimulationScenario;
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const [mask, setMask] = useState("adult");
  const [position, setPosition] = useState("sniff");
  const [seal, setSeal] = useState("one");
  const [rate, setRate] = useState(10);
  const indicated = state.physiology.respiratoryRate < 10 || state.physiology.oxygenation < 30;
  function submit() {
    const technique = mask === "adult" && ["sniff", "jaw"].includes(position) && seal === "two" && rate >= 10 && rate <= 12;
    const correct = indicated && technique;
    onComplete({
      duration: 45,
      scoreModifier: correct ? 28 : -22,
      physiologyDelta: correct ? { oxygenation: 24, spo2: 10 } : { oxygenation: -4 },
      message: !indicated
        ? "患者目前仍有相對有效自主呼吸，直接使用 BVM 可能造成過度通氣。"
        : correct
          ? `成人面罩、${position === "jaw" ? "下顎推舉" : "適當擺位"}、雙人密合，以每分鐘 ${rate} 次通氣；胸廓規則起伏且漏氣少。`
          : `BVM 技術未達有效通氣：面罩${mask === "adult" ? "尺寸適合" : "尺寸不合"}、${seal === "two" ? "雙人密合" : "單人密合不穩"}、頻率 ${rate}/min。`,
    });
  }
  return (
    <div className="procedure-body">
      <ChoiceGroup label="面罩尺寸" value={mask} onChange={setMask} options={[["small", "小"], ["adult", "成人"], ["large", "大"]]} />
      <ChoiceGroup label="呼吸道擺位" value={position} onChange={setPosition} options={[["sniff", "壓額抬下巴／嗅吸姿勢"], ["jaw", "下顎推舉"]]} />
      <ChoiceGroup label="面罩密合" value={seal} onChange={setSeal} options={[["one", "單人 E-C 手法"], ["two", "雙人雙手密合"]]} />
      <RangeInput label="通氣頻率" value={rate} min={6} max={20} suffix="次／分" onChange={setRate} />
      <SubmitButton onClick={submit} />
    </div>
  );
}

function AirwayProcedure({
  scenario,
  state,
  onComplete,
}: {
  scenario: SimulationScenario;
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const [position, setPosition] = useState("chin");
  const [suction, setSuction] = useState("no");
  const [adjunct, setAdjunct] = useState("none");
  const secretions = /(分泌物|嘔吐物|異物)/.test(scenario.observations.airway ?? "");
  const unconscious = state.physiology.consciousness < 25;
  function submit() {
    const suctionCorrect = secretions ? suction === "yes" : suction === "no";
    const adjunctCorrect = unconscious ? adjunct === "opa" : adjunct === "none";
    const correct = suctionCorrect && adjunctCorrect;
    onComplete({
      duration: 35 + (suction === "yes" ? 15 : 0) + (adjunct !== "none" ? 12 : 0),
      scoreModifier: correct ? 22 : -16,
      physiologyDelta: correct ? { oxygenation: 8 } : { oxygenation: -8 },
      message: correct
        ? `已完成${position === "jaw" ? "下顎推舉" : "壓額抬下巴"}，${secretions ? "抽吸後分泌物清除" : "未見需抽吸物"}，輔具選擇適當；呼吸道重新評估為暢通。`
        : `呼吸道處置需修正：${!suctionCorrect ? "抽吸判斷不符；" : ""}${!adjunctCorrect ? "輔具與意識／咽反射不符。" : ""}`,
    });
  }
  return (
    <div className="procedure-body">
      <ChoiceGroup label="打開呼吸道" value={position} onChange={setPosition} options={[["chin", "壓額抬下巴"], ["jaw", "下顎推舉"]]} />
      <ChoiceGroup label="是否抽吸" value={suction} onChange={setSuction} options={[["no", "不抽吸"], ["yes", "抽吸可見分泌物"]]} />
      <ChoiceGroup label="呼吸道輔具" value={adjunct} onChange={setAdjunct} options={[["none", "暫不置入"], ["opa", "OPA"], ["npa", "NPA"]]} />
      <SubmitButton onClick={submit} />
    </div>
  );
}

function BleedingProcedure({
  state,
  onComplete,
}: {
  state: SimulationState;
  onComplete: (actionId: string, result: ProcedureResolution) => void;
}) {
  const [method, setMethod] = useState("pressure");
  const [pressureTime, setPressureTime] = useState(60);
  const [placement, setPlacement] = useState("proximal");
  const severe = state.physiology.bleedingRate >= 5;
  function submit() {
    const actionId = method === "tourniquet" ? "tourniquet" : "direct-pressure";
    const correct =
      method === "pressure"
        ? pressureTime >= 60
        : method === "packing"
          ? severe && pressureTime >= 60
          : severe && placement === "proximal";
    onComplete(actionId, {
      duration: method === "pressure" ? pressureTime : 35,
      scoreModifier: correct ? 26 : -18,
      physiologyDelta: correct ? { perfusion: 8, bleedingRate: -8 } : { perfusion: -5 },
      message: correct
        ? method === "pressure"
          ? `持續直接加壓 ${pressureTime} 秒後，活動性出血明顯下降；需保持壓力並再評估。`
          : method === "packing"
            ? `傷口填塞後持續加壓 ${pressureTime} 秒，出血明顯下降；需維持敷料位置。`
            : "止血帶置於傷口近心端、避開關節並拉緊至出血停止，已記錄時間。"
        : method === "pressure"
          ? `僅加壓 ${pressureTime} 秒便放開檢查，血塊可能受破壞且出血未充分控制。`
          : `止血帶位置「${placement === "joint" ? "跨越關節" : "位置不正確"}」，無法可靠控制出血。`,
    });
  }
  return (
    <div className="procedure-body">
      <ChoiceGroup label="止血方式" value={method} onChange={setMethod} options={[["pressure", "敷料直接加壓"], ["packing", "傷口填塞並加壓"], ["tourniquet", "止血帶"]]} />
      {method !== "tourniquet" ? (
        <RangeInput label="持續加壓時間" value={pressureTime} min={15} max={180} step={15} suffix="秒" onChange={setPressureTime} />
      ) : (
        <ChoiceGroup label="止血帶位置" value={placement} onChange={setPlacement} options={[["distal", "傷口遠心端"], ["joint", "跨越最近關節"], ["proximal", "傷口近心端並避開關節"]]} />
      )}
      <SubmitButton onClick={submit} />
    </div>
  );
}

function CprProcedure({
  state,
  onComplete,
}: {
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const [pulseChecked, setPulseChecked] = useState(false);
  const [helpCalled, setHelpCalled] = useState(false);
  const [rate, setRate] = useState(110);
  const [ratio, setRatio] = useState("30:2");
  const [pads, setPads] = useState("correct");
  const [clear, setClear] = useState(false);
  const arrest = state.physiology.perfusion <= 10;
  function submit() {
    const technique = pulseChecked && helpCalled && rate >= 100 && rate <= 120 && ratio === "30:2" && pads === "correct" && clear;
    const correct = arrest && technique;
    onComplete({
      duration: 150,
      scoreModifier: correct ? 32 : -28,
      physiologyDelta: correct ? { perfusion: 18, oxygenation: 8 } : { perfusion: -6 },
      message: !arrest
        ? "患者仍有循環徵象，不應開始 CPR 或進行 AED 分析。"
        : correct
          ? `已呼叫支援，以 ${rate}/min、${ratio} 執行 CPR；貼片位置正確，分析前確認所有人離開病患。`
          : "復甦流程不完整：請確認脈搏、呼叫支援、壓胸 100–120/min、30:2、貼片位置及分析前離開病患。",
    });
  }
  return (
    <div className="procedure-body">
      <div className="check-grid">
        <label><input type="checkbox" checked={pulseChecked} onChange={(event) => setPulseChecked(event.target.checked)} /> 已確認無脈搏</label>
        <label><input type="checkbox" checked={helpCalled} onChange={(event) => setHelpCalled(event.target.checked)} /> 已呼叫支援並取得 AED</label>
        <label><input type="checkbox" checked={clear} onChange={(event) => setClear(event.target.checked)} /> 分析／電擊前確認無人接觸</label>
      </div>
      <RangeInput label="壓胸速率" value={rate} min={80} max={140} suffix="次／分" onChange={setRate} />
      <ChoiceGroup label="壓胸通氣比" value={ratio} onChange={setRatio} options={[["15:2", "15:2"], ["30:2", "30:2"], ["連續", "連續壓胸、不通氣"]]} />
      <ChoiceGroup label="AED 貼片" value={pads} onChange={setPads} options={[["reversed", "左右相反"], ["same-side", "兩片同側"], ["correct", "右鎖骨下＋左側胸"]]} />
      <SubmitButton onClick={submit} />
    </div>
  );
}

function TransportProcedure({
  action,
  scenario,
  state,
  onComplete,
}: {
  action: SimulationAction;
  scenario: SimulationScenario;
  state: SimulationState;
  onComplete: (result: ProcedureResolution) => void;
}) {
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);

  function syncReason() {
    const value = reasonRef.current?.value ?? "";
    const trimmed = value.trim();
    const contentLength = trimmed.replace(/\s/g, "").length;
    setCharCount(trimmed.length);
    setCanSubmit(contentLength >= 2);
  }

  function submit() {
    const trimmed = (reasonRef.current?.value ?? "").trim();
    if (trimmed.replace(/\s/g, "").length < 2) return;
    onComplete({
      duration: action.duration + 25,
      scoreModifier: trimmed.length >= 18 ? 8 : 0,
      message: `已選擇「${action.label}」，危急個案送醫原因紀錄為：「${trimmed}」。`,
      transportReason: trimmed,
    });
  }

  return (
    <div className="procedure-body transport-procedure-layout">
      <TransportReferencePanel scenario={scenario} state={state} />
      <div className="transport-entry">
        <p className="procedure-instruction">
          你即將把「{scenario.patient}」送往「{action.label.replace("送往", "")}」。請對照左側傷病患資料，以救護紀錄方式說明為何判定為危急個案。
        </p>
        <label className="transport-reason-field">
          <span>送醫原因（危急個案）</span>
          <textarea
            ref={reasonRef}
            defaultValue=""
            maxLength={300}
            onCompositionEnd={syncReason}
            onInput={syncReason}
            placeholder="例如：意識改變、呼吸窘迫、血氧偏低，需高優先送醫……"
            rows={5}
          />
          <small>{charCount}/300 字 · 至少 2 字即可送出</small>
        </label>
        <SubmitButton disabled={!canSubmit} onClick={submit} />
      </div>
    </div>
  );
}

function TransportReferencePanel({
  scenario,
  state,
}: {
  scenario: SimulationScenario;
  state: SimulationState;
}) {
  const assessment = assessCriticalCase(scenario, state);
  const condition = getPatientCondition(state.physiology);

  return (
    <aside className="transport-reference panel">
      <span className="eyebrow">PATIENT DATA</span>
      <h3>傷病患資料</h3>
      <div className="transport-reference-heading">
        <div>
          <strong>{scenario.patient}，{scenario.age} 歲</strong>
          <p>{scenario.chiefComplaint}</p>
        </div>
        <div className="transport-condition">
          <strong>{condition}</strong>
          <span>病況指標</span>
        </div>
      </div>

      <div className="monitor-grid transport-monitor-grid">
        <ReferenceMonitor
          label="意識 AVPU"
          measurement={state.measurements.appearance}
          value={
            state.completedActionIds.includes("check-response")
              ? consciousnessLabel(state.physiology.consciousness)
              : null
          }
          age={state.elapsed}
          measuredAt={findLogTime(state, "check-response")}
        />
        <ReferenceMonitor label="GCS" measurement={state.measurements.gcs} age={state.elapsed} />
        <ReferenceMonitor label="脈搏" measurement={state.measurements.pulse} age={state.elapsed} />
        <ReferenceMonitor label="呼吸" measurement={state.measurements.respiratoryRate} age={state.elapsed} />
        <ReferenceMonitor label="血壓" measurement={state.measurements.bloodPressure} age={state.elapsed} />
        <ReferenceMonitor label="SpO₂" measurement={state.measurements.spo2} age={state.elapsed} />
        <ReferenceMonitor label="體溫" measurement={state.measurements.temperature} age={state.elapsed} />
        <ReferenceMonitor label="血糖" measurement={state.measurements.glucose} age={state.elapsed} />
      </div>

      <div className="transport-reference-section">
        <h4>現場與評估資訊</h4>
        {state.revealed.length === 0 ? (
          <p className="locked-copy">尚未取得額外觀察或問診資訊。</p>
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

      <div className="transport-reference-section">
        <h4>客觀危急徵象</h4>
        {assessment.criteria.length ? (
          <div className="critical-criteria-list compact">
            {assessment.criteria.map((criterion) => (
              <div key={`${criterion.category}-${criterion.standard}`}>
                <span>{criterion.category}</span>
                <strong>{criterion.standard}</strong>
                <p>{criterion.evidence}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>目前客觀數值未跨越標準危急門檻。</p>
        )}
        <div className="gcs-comparison">
          <span>送醫時 GCS</span>
          <strong>{getGcsDisplay(state.physiology.consciousness)}</strong>
        </div>
        {state.playerReport.gcs && (
          <div className="gcs-comparison">
            <span>玩家 GCS 評分</span>
            <strong>
              E{state.playerReport.gcs.eye} V{state.playerReport.gcs.verbal} M{state.playerReport.gcs.motor}＝{state.playerReport.gcs.total}
            </strong>
          </div>
        )}
      </div>
    </aside>
  );
}

function ReferenceMonitor({
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
        {time === undefined ? "需評估／使用儀器" : `${formatProcedureTime(time)} 取得${stale ? " · 已過期" : ""}`}
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

function formatProcedureTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="procedure-field">
      <legend>{label}</legend>
      <div className="procedure-choices">
        {options.map(([id, text]) => (
          <button className={value === id ? "selected" : ""} key={id} onClick={() => onChange(id)} type="button">{text}</button>
        ))}
      </div>
    </fieldset>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>{label}</span>
      <strong>{value} {suffix}</strong>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></label>
  );
}

function GcsActionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="gcs-action-group">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function gcsPatientResponse(
  id: string,
  actual: { eye: number; verbal: number; motor: number },
  scenario: SimulationScenario,
): string {
  if (id === "eye-observe") {
    return actual.eye === 4
      ? "患者在未受刺激前已自行睜眼，視線會追蹤周遭人員。"
      : "患者雙眼閉合，未見自發睜眼。";
  }
  if (["eye-normal-call", "eye-loud-call", "eye-shoulder"].includes(id)) {
    return actual.eye >= 3
      ? "患者在聲音刺激後睜眼並短暫注視你。"
      : "聲音與輕拍刺激後仍未睜眼。";
  }
  if (id === "eye-pain") {
    return actual.eye >= 2
      ? "施加適當刺激後患者短暫睜眼，停止刺激後再次閉眼。"
      : "適當疼痛刺激後仍未睜眼。";
  }

  if (id.startsWith("verbal-")) {
    if (actual.verbal === 5) {
      const answers: Record<string, string> = {
        "verbal-name": `患者清楚回答：「我叫${scenario.patient}。」`,
        "verbal-place": `患者正確說出目前位於${scenario.environment.location}。`,
        "verbal-time": "患者可正確回答目前年份與月份。",
        "verbal-event": `患者能連貫描述與「${scenario.dispatch}」相符的事件經過。`,
        "verbal-repeat": "患者完整且正確重複指定句子。",
      };
      return answers[id];
    }
    if (actual.verbal === 4) {
      const confused: Record<string, string> = {
        "verbal-name": `患者回答姓名為${scenario.patient}。`,
        "verbal-place": "患者可以交談，但說出錯誤地點，經提醒後仍不確定。",
        "verbal-time": "患者回答錯誤年份，並反覆詢問現在幾點。",
        "verbal-event": "患者可說出片段經過，但前後順序混亂。",
        "verbal-repeat": "患者可以重複句子，但漏字並加入無關內容。",
      };
      return confused[id];
    }
    if (actual.verbal === 3) {
      return "患者只說出「不要、回家、痛」等零散字詞，無法形成對話。";
    }
    if (actual.verbal === 2) {
      return "患者僅發出呻吟聲，無法辨識為任何字詞。";
    }
    return "患者沒有任何語言或發聲反應。";
  }

  if (id.startsWith("motor-") && !id.includes("pain")) {
    const rightSide = id.includes("right");
    if (scenario.id === "stroke" && rightSide) {
      return "患者理解指令，但右側肢體無法抬起，僅見輕微動作。";
    }
    if (actual.motor === 6) {
      return id.includes("leg")
        ? "患者理解指令並將指定側腳抬離床面後放下。"
        : id === "motor-fingers"
          ? "患者依指令比出兩根手指。"
          : "患者依指令完成握緊與放開。";
    }
    return "患者無法依照動作指令完成指定動作。";
  }

  if (actual.motor >= 5) {
    return "患者以手越過身體中線，抓住並推開施加刺激的手。";
  }
  if (actual.motor === 4) {
    return "受刺激肢體迅速屈曲並遠離刺激，但手未移向刺激位置。";
  }
  if (actual.motor === 3) {
    return "刺激後出現上肢異常屈曲、內收反應。";
  }
  if (actual.motor === 2) {
    return "刺激後出現上肢伸直與內旋反應。";
  }
  return "中央及周邊疼痛刺激後均未見肢體動作。";
}

function SubmitButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button className="primary-button procedure-submit" disabled={disabled} onClick={onClick}>完成操作並提交判斷</button>;
}

function gcsFromConsciousness(value: number) {
  return {
    eye: value >= 85 ? 4 : value >= 60 ? 3 : value >= 25 ? 2 : 1,
    verbal: value >= 85 ? 5 : value >= 70 ? 4 : value >= 50 ? 3 : value >= 25 ? 2 : 1,
    motor: value >= 85 ? 6 : value >= 70 ? 5 : value >= 50 ? 4 : value >= 35 ? 3 : value >= 20 ? 2 : 1,
  };
}

function procedureKind(id: string) {
  if (id === "gcs-assessment") return "gcs";
  if (id === "oxygen") return "oxygen";
  if (id === "bvm") return "bvm";
  if (id === "airway-management") return "airway";
  if (["direct-pressure", "tourniquet"].includes(id)) return "bleeding";
  if (id.startsWith("transport-")) return "transport";
  return "cpr";
}

function procedureTitle(kind: string) {
  return {
    gcs: "GCS 神經評估",
    oxygen: "氧氣治療設定",
    bvm: "BVM 輔助通氣",
    airway: "呼吸道處置",
    bleeding: "大量出血控制",
    cpr: "CPR／AED 復甦流程",
    transport: "危急個案送醫紀錄",
  }[kind];
}
