import type {
  AssessmentKey,
  Difficulty,
  Measurement,
  Physiology,
  ProcedureResolution,
  SimulationAction,
  SimulationScenario,
  SimulationState,
} from "./types";

/** Actions allowed while the patient is in prehospital cardiac arrest / extremis. */
export const RESUSCITATION_ACTION_IDS = [
  "check-response",
  "check-breathing",
  "check-pulse",
  "check-airway",
  "oxygen",
  "bvm",
  "suction",
  "opa",
  "airway-management",
  "aed-ready",
  "cpr",
  "aed-analyze",
] as const;

export function createSimulationState(
  scenario: SimulationScenario,
): SimulationState {
  const physiology = { ...scenario.initialPhysiology };
  return {
    elapsed: 0,
    physiology,
    revealed: [],
    measurements: {},
    completedActionIds: [],
    activeTreatments: [],
    score: 0,
    log: [],
    status: getPatientCondition(physiology) <= 8 ? "arrest" : "active",
    playerReport: {},
  };
}

export function performSimulationAction(
  scenario: SimulationScenario,
  state: SimulationState,
  action: SimulationAction,
  difficulty: Difficulty,
  resolution?: ProcedureResolution,
): SimulationState {
  if (state.status === "transported") {
    return state;
  }
  if (
    state.status === "arrest" &&
    !RESUSCITATION_ACTION_IDS.includes(
      action.id as (typeof RESUSCITATION_ACTION_IDS)[number],
    )
  ) {
    return {
      ...state,
      log: [
        {
          id: `blocked-${action.id}-${state.elapsed}`,
          label: action.label,
          message:
            "病患已陷入極危急狀態，請先完成呼吸／脈搏再評估，並從下方復甦處置清單選擇適當處置。",
          elapsed: state.elapsed,
          tone: "danger",
        },
        ...state.log,
      ],
    };
  }
  if (!action.repeatable && state.completedActionIds.includes(action.id)) return state;

  const duration = resolution?.duration ?? getActionDuration(scenario, action);
  let physiology = advancePhysiology(
    scenario,
    state.physiology,
    duration,
    state.activeTreatments,
    difficulty,
  );
  let scoreDelta = scenario.recommendedActionIds.includes(action.id) ? 12 : 0;
  scoreDelta += resolution?.scoreModifier ?? 0;
  let tone: "good" | "neutral" | "danger" = scoreDelta > 0 ? "good" : "neutral";
  let message = action.description;
  const activeTreatments = [...state.activeTreatments];

  if (
    !["ppe-scene", "control-hazards"].includes(action.id) &&
    !state.completedActionIds.includes("ppe-scene")
  ) {
    scoreDelta -= 6;
    physiology.perfusion = clamp(physiology.perfusion - 2, 0, 100);
    message = `未先完成場景安全；你與病患仍暴露於危害。${message}`;
    tone = "danger";
  }
  if (
    !["ppe-scene", "control-hazards"].includes(action.id) &&
    state.completedActionIds.includes("ppe-scene") &&
    !state.completedActionIds.includes("control-hazards")
  ) {
    scoreDelta -= 5;
    message = `現場危害尚未完成控制。${message}`;
    tone = "danger";
  }
  if (
    action.id === "control-hazards" &&
    !state.completedActionIds.includes("ppe-scene")
  ) {
    scoreDelta -= 12;
    tone = "danger";
    message = "尚未完成危害辨識便嘗試進入控制，增加未知暴露風險。";
  }

  if (scenario.dangerousActionIds.includes(action.id)) {
    scoreDelta -= 24;
    physiology = applyDangerousConsequence(action.id, physiology);
    tone = "danger";
    message = `${message} 此選擇使目前病況惡化。`;
  }

  const treatment = applyTreatment(action.id, physiology, scenario);
  physiology = treatment.physiology;
  if (resolution?.physiologyDelta) {
    physiology = normalizePhysiology(
      Object.fromEntries(
        Object.entries(physiology).map(([key, value]) => [
          key,
          value +
            (resolution.physiologyDelta?.[key as keyof Physiology] ?? 0),
        ]),
      ) as unknown as Physiology,
    );
  }
  if (treatment.warning) {
    scoreDelta -= 18;
    tone = "danger";
    message = treatment.warning;
  } else if (action.kind === "treatment" && !activeTreatments.includes(action.id)) {
    activeTreatments.push(action.id);
  }

  const revealed = [...new Set([...state.revealed, ...(action.reveals ?? [])])];
  const measurements = { ...state.measurements };
  for (const key of action.reveals ?? []) {
    if (isMeasuredValue(key)) {
      measurements[key] = makeMeasurement(key, physiology, state.elapsed + duration);
    }
  }
  if (action.id === "check-response") {
    measurements.appearance = {
      key: "appearance",
      value: consciousnessLabel(physiology.consciousness),
      measuredAt: state.elapsed + duration,
    };
  }
  if (!treatment.warning && !scenario.dangerousActionIds.includes(action.id)) {
    const concreteResult = buildActionResult(
      scenario,
      action,
      physiology,
      measurements,
      duration,
    );
    message =
      tone === "danger"
        ? `${message} 實際結果：${concreteResult}`
        : concreteResult;
  }
  if (resolution) {
    message = resolution.message;
    tone = resolution.scoreModifier < 0 ? "danger" : resolution.scoreModifier > 0 ? "good" : tone;
    if (
      !["ppe-scene", "control-hazards"].includes(action.id) &&
      !state.completedActionIds.includes("control-hazards")
    ) {
      message = `現場危害尚未完成控制。${message}`;
      tone = "danger";
    }
  }

  const transported = action.kind === "transport";
  if (transported) {
    if (action.id === scenario.transportDestination) {
      scoreDelta += 20;
      message = "目的醫院選擇符合病況，已完成預告並持續再評估。";
      tone = "good";
    } else {
      scoreDelta -= 18;
      message = "目的醫院能力可能不符病況，轉院風險與治療延誤增加。";
      tone = "danger";
    }
  }

  const condition = getPatientCondition(physiology);
  const status =
    transported ? "transported" : condition <= 8 ? "arrest" : "active";

  return {
    elapsed: state.elapsed + duration,
    physiology,
    revealed,
    measurements,
    completedActionIds: state.completedActionIds.includes(action.id)
      ? state.completedActionIds
      : [...state.completedActionIds, action.id],
    activeTreatments,
    score: Math.max(0, state.score + Math.round(scoreDelta * difficulty.scoreMultiplier)),
    status,
    playerReport: {
      ...state.playerReport,
      ...(resolution?.playerGcs ? { gcs: resolution.playerGcs } : {}),
      ...(resolution?.transportReason
        ? { transportReason: resolution.transportReason }
        : {}),
    },
    log: [
      {
        id: `${action.id}-${state.elapsed}`,
        label: action.label,
        message,
        elapsed: state.elapsed + duration,
        tone,
      },
      ...state.log,
    ],
  };
}

export function getActionDuration(
  scenario: SimulationScenario,
  action: SimulationAction,
): number {
  return action.id === "control-hazards"
    ? scenario.environment.hazardControlTime
    : action.duration;
}

function buildActionResult(
  scenario: SimulationScenario,
  action: SimulationAction,
  physiology: Physiology,
  measurements: SimulationState["measurements"],
  duration: number,
): string {
  const observation = (key: AssessmentKey) =>
    scenario.observations[key] ?? "未發現明顯異常。";
  switch (action.id) {
    case "ppe-scene":
      return `現場不安全：發現${scenario.environment.hazards.join("、")}。危害辨識耗時 ${duration} 秒，尚須執行控制。`;
    case "control-hazards":
      return `已花費 ${duration} 秒建立安全區並控制${scenario.environment.hazards.join("、")}；現在可安全接近病患。`;
    case "general-impression":
      return `目視結果：${observation("appearance")} ${observation("skin")}`;
    case "check-response":
      return avpuAssessment(physiology.consciousness);
    case "check-airway":
      return `呼吸道評估：${observation("airway")}`;
    case "check-breathing":
      return `呼吸評估：${observation("breathing")} 計數為 ${Math.round(physiology.respiratoryRate)} 次／分。`;
    case "check-pulse":
      return circulationAssessment(physiology, observation("skin"));
    case "expose-examine":
      return `傷病檢查：${observation("injuries")} ${observation("bleeding")}`;
    case "bp-cuff":
      return `血壓計讀值：${measurements.bloodPressure?.value ?? "量測失敗"}。`;
    case "pulse-ox":
      return `血氧機讀值：SpO₂ ${measurements.spo2?.value ?? "量測失敗"}；需結合呼吸作功與訊號品質判讀。`;
    case "thermometer":
      return `體溫計讀值：${measurements.temperature?.value ?? "量測失敗"}。`;
    case "glucose-meter":
      return `血糖機讀值：${measurements.glucose?.value ?? "量測失敗"}。`;
    case "sample":
      return `SAMPLE 問診結果：${observation("sampleHistory")}`;
    case "opqrst":
      return `OPQRST 問診結果：${observation("opqrst")}`;
    case "fast":
      return `中風評估：${observation("stroke")}`;
    case "direct-pressure":
      return `直接加壓後出血率降至 ${physiology.bleedingRate.toFixed(1)}/10；仍需目視並追蹤灌流。`;
    case "tourniquet":
      return "止血帶已完成固定並記錄時間；目前未見持續肢體活動性出血。";
    case "oxygen":
      return "已開始給氧；生理氧合開始改善，需重新觀察呼吸並量測 SpO₂ 確認效果。";
    case "upright":
      return "已協助採舒適坐姿；病患軀幹可自行維持，需重新評估呼吸作功。";
    case "supine":
      return "已協助平躺並保護呼吸道；需持續觀察意識、嘔吐及呼吸變化。";
    case "blanket":
      return "已完成保暖與防休克照護；需重新量測體溫及灌流狀態。";
    case "active-cooling":
      return `已停止熱暴露並降溫，目前推估體溫 ${physiology.bodyTemperature.toFixed(1)} °C；需用體溫計複測。`;
    case "oral-glucose":
      return `病患可安全吞嚥，口服後推估血糖回升；需用血糖機複測。`;
    case "splint":
      return "已完成傷處固定；需比較固定前後的末梢脈搏、感覺與活動。";
    case "aed-ready":
      return "AED 已開機並置於病患旁，持續監測意識、呼吸與脈搏。";
    case "suction":
      return "已完成口腔抽吸；可見分泌物已清除，需重新確認呼吸道聲音。";
    case "opa":
      return "口咽呼吸道已置入；需確認無咽反射、位置適當且通氣有效。";
    case "bvm":
      return `輔助通氣後氧合改善，推估 SpO₂ ${Math.round(physiology.spo2)}%；需重新量測確認。`;
    case "cpr":
      return "已完成一個 CPR 循環；立即重新確認心律與循環徵象。";
    case "aed-analyze":
      return "AED 分析完成；依機器指示持續 CPR 或準備電擊，並確認所有人離開病患。";
    default:
      return `已完成「${action.label}」，目前病況指標 ${getPatientCondition(physiology)}。`;
  }
}

function circulationAssessment(
  physiology: Physiology,
  skinFinding: string,
): string {
  const pulse = Math.round(physiology.pulse);
  if (pulse <= 0 || physiology.perfusion <= 0) {
    return `循環評估：頸動脈與橈動脈均無法觸及，未測得有效脈搏；指端微血管充填無法判讀。${skinFinding} 綜合判斷：無有效循環徵象，應立即啟動心跳停止處置流程。`;
  }

  const radialFinding =
    physiology.perfusion >= 55
      ? "雙側橈動脈可清楚觸及"
      : physiology.perfusion >= 30
        ? "雙側橈動脈可觸及但細弱"
        : "橈動脈難以觸及，頸動脈仍可觸得";
  const rateFinding =
    pulse > 150
      ? "極度心搏過速"
      : pulse > 100
        ? "心搏過速"
        : pulse < 50
          ? "明顯心搏過緩"
          : pulse < 60
            ? "心搏偏慢"
            : "速率在成人一般範圍";
  const strengthFinding =
    physiology.perfusion >= 70
      ? "脈搏強度飽滿"
      : physiology.perfusion >= 50
        ? "脈搏強度稍弱"
        : physiology.perfusion >= 30
          ? "脈搏細弱"
          : "中央脈搏微弱";
  const refillSeconds =
    physiology.perfusion >= 70
      ? "小於 2 秒"
      : physiology.perfusion >= 55
        ? "約 2 秒"
        : physiology.perfusion >= 35
          ? "約 3 秒"
          : physiology.perfusion >= 20
            ? "約 4 秒"
            : "超過 5 秒";
  const conclusion =
    physiology.perfusion >= 70
      ? "目前未見明顯周邊循環障礙，仍需配合血壓與後續趨勢判讀"
      : physiology.perfusion >= 50
        ? "已有早期周邊灌流下降，需警覺疼痛、脫水或代償性休克"
        : physiology.perfusion >= 30
          ? "脈搏與微血管充填顯示明顯循環灌流異常，符合休克警訊"
          : "中央與末梢循環均嚴重受損，可能正進入失代償性休克";

  return `循環評估：${radialFinding}；脈搏 ${pulse} 次／分，${rateFinding}，觸診期間節律規則，${strengthFinding}。指端微血管充填 ${refillSeconds}。皮膚觀察：${skinFinding} 綜合判斷：${conclusion}。`;
}

export function advanceWithoutAction(
  scenario: SimulationScenario,
  state: SimulationState,
  seconds: number,
  difficulty: Difficulty,
  recordLog = true,
): SimulationState {
  if (state.status !== "active") return state;
  const physiology = advancePhysiology(
    scenario,
    state.physiology,
    seconds,
    state.activeTreatments,
    difficulty,
  );
  const before = getPatientCondition(state.physiology);
  const after = getPatientCondition(physiology);
  return {
    ...state,
    elapsed: state.elapsed + seconds,
    physiology,
    status: getPatientCondition(physiology) <= 8 ? "arrest" : "active",
    log: recordLog
      ? [
          {
            id: `observe-${state.elapsed}`,
            label: `觀察 ${seconds} 秒`,
            message:
              after < before
                ? `未採取處置期間，病況指標由 ${before} 降至 ${after}；原有儀器讀值仍停留在量測當下。`
                : `觀察期間病況指標維持在 ${after}；仍需重新評估才能取得目前數值。`,
            elapsed: state.elapsed + seconds,
            tone: after < before ? "danger" : "neutral",
          },
          ...state.log,
        ]
      : state.log,
  };
}

export function getPatientCondition(physiology: Physiology): number {
  const temperaturePenalty = Math.max(
    0,
    Math.abs(physiology.bodyTemperature - 37) * 8,
  );
  return clamp(
    Math.round(
      physiology.perfusion * 0.4 +
        physiology.oxygenation * 0.35 +
        physiology.consciousness * 0.25 -
        temperaturePenalty,
    ),
    0,
    100,
  );
}

export function getGcsDisplay(consciousness: number): string {
  const gcs = gcsComponents(consciousness);
  return `E${gcs.eye} V${gcs.verbal} M${gcs.motor}＝${gcs.eye + gcs.verbal + gcs.motor}`;
}

export interface CriticalAssessment {
  classification: "一級危急" | "危急個案" | "未達危急門檻";
  criteria: {
    category: "生命徵象" | "外傷部位／機轉" | "特殊情況";
    standard: string;
    evidence: string;
  }[];
  urgentReason: string;
}

export function assessCriticalCase(
  scenario: SimulationScenario,
  state: SimulationState,
): CriticalAssessment {
  const initial = scenario.initialPhysiology;
  const current = state.physiology;
  const initialGcs = gcsComponents(initial.consciousness);
  const currentGcs = gcsComponents(current.consciousness);
  const initialGcsTotal = initialGcs.eye + initialGcs.verbal + initialGcs.motor;
  const currentGcsTotal = currentGcs.eye + currentGcs.verbal + currentGcs.motor;
  const criteria: CriticalAssessment["criteria"] = [];
  const add = (
    category: CriticalAssessment["criteria"][number]["category"],
    standard: string,
    evidence: string,
  ) => criteria.push({ category, standard, evidence });
  const course = (label: string, before: number, after: number, unit: string) =>
    `${label}：初始 ${Math.round(before)}${unit}，送醫時 ${Math.round(after)}${unit}`;

  if (initialGcsTotal < 14 || currentGcsTotal < 14) {
    add(
      "生命徵象",
      "急性意識不清：GCS＜14",
      `GCS：初始 ${initialGcsTotal} 分，送醫時 ${currentGcsTotal} 分`,
    );
  }
  if (
    initial.respiratoryRate >= 30 ||
    initial.respiratoryRate < 10 ||
    current.respiratoryRate >= 30 ||
    current.respiratoryRate < 10
  ) {
    add(
      "生命徵象",
      "呼吸頻率：≧30 或＜10 次／分鐘",
      course("呼吸", initial.respiratoryRate, current.respiratoryRate, " 次／分"),
    );
  }
  if (
    initial.pulse > 150 ||
    initial.pulse < 50 ||
    current.pulse > 150 ||
    current.pulse < 50
  ) {
    add(
      "生命徵象",
      "脈搏：＞150 或＜50 次／分鐘",
      course("脈搏", initial.pulse, current.pulse, " 次／分"),
    );
  }
  if (
    initial.systolic > 220 ||
    initial.systolic < 90 ||
    current.systolic > 220 ||
    current.systolic < 90
  ) {
    add(
      "生命徵象",
      "收縮壓：＞220 或＜90 mmHg",
      course("收縮壓", initial.systolic, current.systolic, " mmHg"),
    );
  }
  if (
    initial.bodyTemperature > 41 ||
    initial.bodyTemperature < 32 ||
    current.bodyTemperature > 41 ||
    current.bodyTemperature < 32
  ) {
    add(
      "生命徵象",
      "核心體溫：＞41°C 或＜32°C",
      `體溫：初始 ${initial.bodyTemperature.toFixed(1)}°C，送醫時 ${current.bodyTemperature.toFixed(1)}°C`,
    );
  }
  if (initial.spo2 < 90 || current.spo2 < 90) {
    add(
      "生命徵象",
      "血氧濃度：SpO₂＜90%",
      course("SpO₂", initial.spo2, current.spo2, "%"),
    );
  }
  if (initial.glucose < 60 || current.glucose < 60) {
    add(
      "特殊情況",
      "血糖值＜60 mg/dL",
      course("血糖", initial.glucose, current.glucose, " mg/dL"),
    );
  }

  const searchable = [
    scenario.id,
    scenario.title,
    scenario.chiefComplaint,
    scenario.observations.injuries,
    scenario.observations.airway,
    ...scenario.criticalFactors,
  ].join(" ");
  if (scenario.transportDestination === "transport-stroke") {
    add("特殊情況", "疑似急性腦中風", scenario.observations.stroke ?? "出現急性局部神經學異常。");
  }
  if (scenario.id === "chest-pain") {
    add("特殊情況", "疑似缺血性胸痛發作", scenario.observations.opqrst ?? scenario.chiefComplaint);
  }
  if (/(opioid|carbon-monoxide)/.test(scenario.id)) {
    add("特殊情況", "中毒可能危及生命", scenario.chiefComplaint);
  }
  if (scenario.id.startsWith("drowning-")) {
    add("特殊情況", "溺水", scenario.chiefComplaint);
  }
  if (scenario.id.startsWith("electric-")) {
    add("外傷部位／機轉", "重大電擊傷", scenario.observations.injuries ?? scenario.chiefComplaint);
  }
  if (/吸入性|鼻毛焦黑|口鼻煙灰/.test(searchable)) {
    add("外傷部位／機轉", "疑似吸入性灼傷", scenario.observations.airway ?? scenario.chiefComplaint);
  }
  if (
    scenario.age <= 8 &&
    (initialGcsTotal < 14 ||
      initial.spo2 < 90 ||
      initial.respiratoryRate >= 30)
  ) {
    add("特殊情況", "小兒評估危急", "兒童外觀、呼吸或循環呈現異常，具有快速失代償風險。");
  }

  const tierOne =
    initial.pulse <= 0 ||
    current.pulse <= 0 ||
    initial.respiratoryRate <= 0 ||
    current.respiratoryRate <= 0 ||
    Math.min(initialGcsTotal, currentGcsTotal) <= 8 ||
    Math.min(initial.oxygenation, current.oxygenation) < 30 ||
    Math.min(initial.perfusion, current.perfusion) < 30 ||
    Math.min(initial.systolic, current.systolic) < 70 ||
    initial.bodyTemperature > 41 ||
    initial.bodyTemperature < 32 ||
    current.bodyTemperature > 41 ||
    current.bodyTemperature < 32;
  const classification = tierOne
    ? "一級危急"
    : criteria.length > 0
      ? "危急個案"
      : "未達危急門檻";
  const urgentReason =
    classification === "一級危急"
      ? "病患可能正處於呼吸／循環衰竭、重度意識障礙或休克，需立即處置、持續監測並儘速送往就近適當醫療機構。"
      : classification === "危急個案"
        ? "已符合救護員危急個案判定條件，病況可能快速惡化；應縮短現場時間、途中密切再評估並儘速後送。"
        : "目前量測未跨越危急個案數值門檻，但仍需依症狀、病史及受傷機轉送醫進一步檢查；不應把「未達門檻」解讀為不需送醫。";

  return { classification, criteria, urgentReason };
}

export function getObservation(
  scenario: SimulationScenario,
  state: SimulationState,
  key: AssessmentKey,
): string {
  const base = scenario.observations[key] ?? "未發現明顯異常。";
  if (key === "skin" && state.physiology.perfusion < 40) {
    return `${base} 目前末梢膚色更加蒼白，觸感濕冷。`;
  }
  if (key === "bleeding" && state.activeTreatments.includes("tourniquet")) {
    return `${base} 止血帶處置後目前未見持續活動性出血。`;
  }
  if (key === "bleeding" && state.activeTreatments.includes("direct-pressure")) {
    return state.physiology.bleedingRate <= 1
      ? `${base} 持續加壓後目前僅見少量滲血。`
      : `${base} 加壓後出血量已下降，但敷料仍有持續滲血，需再評估控制效果。`;
  }
  if (key === "breathing" && state.physiology.oxygenation < 30) {
    return `${base} 現在呼吸更費力，意識反應也開始下降。`;
  }
  return base;
}

export function measurementIsStale(
  measurement: Measurement,
  elapsed: number,
): boolean {
  return elapsed - measurement.measuredAt >= 90;
}

export function summarizeOutcome(
  scenario: SimulationScenario,
  state: SimulationState,
) {
  const dangerousChoices = state.log.filter((entry) => entry.tone === "danger").length;
  const completedRecommended = scenario.recommendedActionIds.filter((id) =>
    state.completedActionIds.includes(id),
  ).length;
  const completionRatio = completedRecommended / scenario.recommendedActionIds.length;
  const score = Math.max(
    0,
    state.score +
      Math.round(getPatientCondition(state.physiology) * 0.35) +
      Math.round(completionRatio * 35) -
      dangerousChoices * 5,
  );
  return {
    scenarioId: scenario.id,
    score,
    stability: getPatientCondition(state.physiology),
    elapsed: state.elapsed,
    bestChoices: completedRecommended,
    dangerousChoices,
    grade: score >= 155 ? "S" : score >= 120 ? "A" : score >= 80 ? "B" : "C",
    outcome:
      state.status === "arrest"
        ? "病患在現場陷入極危急狀態。"
        : getPatientCondition(state.physiology) >= 60
          ? "病患在相對穩定狀態下完成送醫。"
          : "病患病況仍不穩定，送醫途中需密切再評估。",
  } as const;
}

function advancePhysiology(
  scenario: SimulationScenario,
  source: Physiology,
  seconds: number,
  activeTreatments: string[],
  difficulty: Difficulty,
): Physiology {
  const minutes = seconds / 60;
  const factor = difficulty.declineRate / 0.14;
  const next = { ...source };
  for (const [key, rate] of Object.entries(scenario.trends) as [
    keyof Physiology,
    number,
  ][]) {
    next[key] += rate * minutes * factor;
  }

  if (next.bleedingRate > 0) {
    next.perfusion -= next.bleedingRate * minutes * 0.7 * factor;
    next.systolic -= next.bleedingRate * minutes * 0.45 * factor;
    next.pulse += next.bleedingRate * minutes * 0.35 * factor;
  }
  if (next.oxygenation < 50) {
    next.consciousness -= (50 - next.oxygenation) * minutes * 0.08 * factor;
  }
  if (activeTreatments.includes("direct-pressure")) {
    next.bleedingRate *= Math.max(0.4, 1 - minutes * 0.5);
  }
  if (activeTreatments.includes("tourniquet")) next.bleedingRate = 0;
  if (activeTreatments.includes("oxygen")) {
    next.oxygenation += 4 * minutes;
    next.spo2 += 1.5 * minutes;
  }
  if (activeTreatments.includes("active-cooling")) {
    next.bodyTemperature -= 0.55 * minutes;
  }
  if (activeTreatments.includes("blanket")) {
    next.bodyTemperature += 0.12 * minutes;
  }

  return normalizePhysiology(next);
}

function applyTreatment(
  id: string,
  source: Physiology,
  scenario: SimulationScenario,
): { physiology: Physiology; warning?: string } {
  const next = { ...source };
  switch (id) {
    case "direct-pressure":
      if (next.bleedingRate < 1)
        return { physiology: next, warning: "未發現需要加壓的活動性外出血，處置沒有適應症。" };
      next.bleedingRate *= 0.22;
      next.perfusion += 5;
      break;
    case "tourniquet":
      if (next.bleedingRate < 5)
        return { physiology: next, warning: "目前出血程度或位置未支持直接使用止血帶。" };
      next.bleedingRate = 0;
      next.perfusion += 7;
      break;
    case "oxygen":
      if (next.spo2 >= 95 && next.oxygenation >= 70)
        return { physiology: next, warning: "目前氧合與血氧未顯示低氧證據，應先確認給氧適應症。" };
      next.oxygenation += 16;
      next.spo2 += 5;
      break;
    case "upright":
      if (next.consciousness < 65) {
        next.perfusion -= 9;
        return { physiology: normalizePhysiology(next), warning: "意識與軀幹控制不足，坐姿增加跌落與呼吸道風險。" };
      }
      next.oxygenation += next.respiratoryRate > 24 ? 5 : 0;
      break;
    case "supine":
      next.perfusion += 5;
      if (next.respiratoryRate > 26) next.oxygenation -= 9;
      break;
    case "blanket":
      if (next.bodyTemperature >= 39) {
        next.bodyTemperature += 0.8;
        next.consciousness -= 6;
        return { physiology: normalizePhysiology(next), warning: "高體溫病患被保暖後散熱受阻，病況惡化。" };
      }
      next.perfusion += 4;
      break;
    case "active-cooling":
      if (next.bodyTemperature < 38) {
        next.bodyTemperature -= 0.5;
        next.perfusion -= 4;
        return { physiology: normalizePhysiology(next), warning: "目前沒有高體溫適應症，過度降溫造成額外風險。" };
      }
      next.bodyTemperature -= 1.1;
      next.consciousness += 7;
      break;
    case "splint":
      if (!scenario.observations.injuries || scenario.observations.injuries.includes("未見"))
        return { physiology: next, warning: "目前未發現需固定的疑似骨折或不穩定傷勢。" };
      break;
    case "suction": {
      const airway = scenario.observations.airway ?? "";
      if (!/(分泌物|嘔吐物|異物)/.test(airway))
        return { physiology: next, warning: "呼吸道評估未發現分泌物或嘔吐物，抽吸沒有明確適應症。" };
      break;
    }
    case "opa":
      if (next.consciousness >= 25)
        return { physiology: next, warning: "病患仍有意識反應，可能保有咽反射，不應置入口咽呼吸道。" };
      break;
    case "oral-glucose":
      if (next.consciousness < 70) {
        next.oxygenation -= 15;
        next.consciousness -= 8;
        return { physiology: normalizePhysiology(next), warning: "病患吞嚥能力不足，口服造成嗆咳與吸入風險。" };
      }
      if (next.glucose >= 70)
        return { physiology: next, warning: "血糖並不低，口服糖分沒有明確適應症。" };
      next.glucose += 42;
      next.consciousness += 18;
      break;
    case "bvm":
      if (next.respiratoryRate > 10 && next.oxygenation > 30)
        return { physiology: next, warning: "病患仍有相對有效自主呼吸，強行輔助通氣可能造成傷害。" };
      next.oxygenation += 20;
      next.spo2 += 8;
      break;
    case "cpr":
      if (next.perfusion > 10)
        return { physiology: next, warning: "病患仍有循環徵象，不應執行胸外按壓。" };
      next.perfusion += 16;
      break;
    case "aed-analyze":
      if (next.perfusion > 10)
        return { physiology: next, warning: "病患仍有脈搏，不符合 AED 分析情境。" };
      break;
  }
  return { physiology: normalizePhysiology(next) };
}

function applyDangerousConsequence(id: string, source: Physiology): Physiology {
  const next = { ...source };
  if (id === "upright") next.perfusion -= 8;
  if (id === "blanket") next.bodyTemperature += 0.7;
  if (id === "active-cooling") next.perfusion -= 6;
  if (id === "oral-glucose") {
    next.oxygenation -= 10;
    next.consciousness -= 8;
  }
  return normalizePhysiology(next);
}

function makeMeasurement(
  key: AssessmentKey,
  physiology: Physiology,
  measuredAt: number,
): Measurement {
  const gcs = gcsComponents(physiology.consciousness);
  const values: Partial<Record<AssessmentKey, string>> = {
    pulse: `${Math.round(physiology.pulse)} /min`,
    respiratoryRate: `${Math.round(physiology.respiratoryRate)} /min`,
    bloodPressure: `${Math.round(physiology.systolic)}/${Math.round(physiology.diastolic)} mmHg`,
    spo2: `${Math.round(physiology.spo2)} %`,
    temperature: `${physiology.bodyTemperature.toFixed(1)} °C`,
    glucose: `${Math.round(physiology.glucose)} mg/dL`,
    gcs: `E${gcs.eye} V${gcs.verbal} M${gcs.motor}＝${gcs.eye + gcs.verbal + gcs.motor}`,
  };
  return { key, value: values[key] ?? "已完成", measuredAt };
}

function isMeasuredValue(key: AssessmentKey): boolean {
  return [
    "pulse",
    "respiratoryRate",
    "bloodPressure",
    "spo2",
    "temperature",
    "glucose",
    "gcs",
  ].includes(key);
}

function normalizePhysiology(value: Physiology): Physiology {
  return {
    pulse: clamp(value.pulse, 20, 220),
    respiratoryRate: clamp(value.respiratoryRate, 0, 50),
    systolic: clamp(value.systolic, 35, 240),
    diastolic: clamp(value.diastolic, 20, 150),
    spo2: clamp(value.spo2, 55, 100),
    bodyTemperature: clamp(value.bodyTemperature, 30, 43),
    glucose: clamp(value.glucose, 15, 500),
    perfusion: clamp(value.perfusion, 0, 100),
    oxygenation: clamp(value.oxygenation, 0, 100),
    bleedingRate: clamp(value.bleedingRate, 0, 10),
    consciousness: clamp(value.consciousness, 0, 100),
  };
}

function consciousnessLabel(value: number): string {
  return value >= 85
    ? "A－清醒"
    : value >= 60
      ? "V－對聲音有反應"
      : value >= 25
        ? "P－對疼痛有反應"
        : "U－無反應";
}

function gcsComponents(value: number) {
  return {
    eye: value >= 85 ? 4 : value >= 60 ? 3 : value >= 25 ? 2 : 1,
    verbal: value >= 85 ? 5 : value >= 70 ? 4 : value >= 50 ? 3 : value >= 25 ? 2 : 1,
    motor: value >= 85 ? 6 : value >= 70 ? 5 : value >= 50 ? 4 : value >= 35 ? 3 : value >= 20 ? 2 : 1,
  };
}

function avpuAssessment(value: number): string {
  if (value >= 85) {
    return "AVPU 完整評估：A－可自行睜眼並正確互動；V－不需聲音刺激；P－不需疼痛刺激；U－否。最終判定：A（清醒）。";
  }
  if (value >= 60) {
    return "AVPU 完整評估：A－無法持續自行清醒；V－呼喚後可睜眼或做出回應；P－不需進一步疼痛刺激；U－否。最終判定：V（對聲音有反應）。";
  }
  if (value >= 25) {
    return "AVPU 完整評估：A－無自行反應；V－呼喚無反應；P－適當疼痛刺激後有動作或發聲；U－否。最終判定：P（對疼痛有反應）。";
  }
  return "AVPU 完整評估：A－無自行反應；V－呼喚無反應；P－適當疼痛刺激仍無反應；U－是。最終判定：U（無反應）。";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
