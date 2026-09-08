import type {
  Difficulty,
  DifficultyId,
  Scenario,
  ScenarioResult,
  ScenarioState,
  VitalSigns,
} from "./types";

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  training: {
    id: "training",
    label: "實習班",
    description: "顯示關鍵提示，病況惡化較慢",
    declineRate: 0.08,
    scoreMultiplier: 0.85,
    showHints: true,
  },
  standard: {
    id: "standard",
    label: "正式值勤",
    description: "標準時間壓力與完整計分",
    declineRate: 0.14,
    scoreMultiplier: 1,
    showHints: false,
  },
  challenge: {
    id: "challenge",
    label: "黃金挑戰",
    description: "病況變化更快，分數加成 20%",
    declineRate: 0.22,
    scoreMultiplier: 1.2,
    showHints: false,
  },
};

export function createScenarioState(): ScenarioState {
  return {
    elapsed: 0,
    stability: 72,
    score: 0,
    completedActionIds: [],
    log: [],
  };
}

export function performAction(
  scenario: Scenario,
  state: ScenarioState,
  actionId: string,
  difficulty: Difficulty,
): ScenarioState {
  const action = scenario.actions.find((item) => item.id === actionId);
  if (!action || state.completedActionIds.includes(actionId)) {
    return state;
  }

  const decline = Math.round(action.timeCost * difficulty.declineRate);
  const scoreDelta = Math.round(action.points * difficulty.scoreMultiplier);
  const stability = clamp(state.stability + action.stabilityDelta - decline, 0, 100);

  return {
    elapsed: state.elapsed + action.timeCost,
    stability,
    score: Math.max(0, state.score + scoreDelta),
    completedActionIds: [...state.completedActionIds, actionId],
    log: [
      {
        id: action.id,
        label: action.label,
        feedback: action.feedback,
        scoreDelta,
        elapsed: state.elapsed + action.timeCost,
      },
      ...state.log,
    ],
  };
}

export function deriveVitals(
  initial: VitalSigns,
  state: ScenarioState,
): VitalSigns {
  const stress = Math.max(0, 72 - state.stability);
  return {
    pulse: clamp(Math.round(initial.pulse + stress * 0.35), 30, 180),
    respiratoryRate: clamp(
      Math.round(initial.respiratoryRate + stress * 0.12),
      6,
      40,
    ),
    systolic: clamp(Math.round(initial.systolic - stress * 0.28), 60, 220),
    diastolic: clamp(Math.round(initial.diastolic - stress * 0.12), 35, 140),
    spo2: clamp(Math.round(initial.spo2 - stress * 0.08), 70, 100),
    consciousness:
      state.stability < 20
        ? "對疼痛有反應"
        : state.stability < 42
          ? "對聲音有反應"
          : initial.consciousness,
  };
}

export function finishScenario(
  scenario: Scenario,
  state: ScenarioState,
): ScenarioResult {
  const missingRequiredIds = scenario.requiredActionIds.filter(
    (id) => !state.completedActionIds.includes(id),
  );
  const missingCriticalCount = scenario.criticalActionIds.filter(
    (id) => !state.completedActionIds.includes(id),
  ).length;
  const timeBonus = Math.max(0, 30 - Math.floor(state.elapsed / 10));
  const finalScore = Math.max(
    0,
    state.score + timeBonus - missingRequiredIds.length * 10 - missingCriticalCount * 15,
  );

  return {
    scenarioId: scenario.id,
    score: finalScore,
    stability: state.stability,
    elapsed: state.elapsed,
    missingRequiredIds,
    grade:
      finalScore >= 115
        ? "S"
        : finalScore >= 90
          ? "A"
          : finalScore >= 65
            ? "B"
            : "C",
  };
}

export function getRequiredProgress(
  scenario: Scenario,
  state: ScenarioState,
): { completed: number; total: number } {
  return {
    completed: scenario.requiredActionIds.filter((id) =>
      state.completedActionIds.includes(id),
    ).length,
    total: scenario.requiredActionIds.length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
