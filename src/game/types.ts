export type DifficultyId = "training" | "standard" | "challenge";

export interface Difficulty {
  id: DifficultyId;
  label: string;
  description: string;
  declineRate: number;
  scoreMultiplier: number;
  showHints: boolean;
}

export interface VitalSigns {
  pulse: number;
  respiratoryRate: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  consciousness: "清醒" | "對聲音有反應" | "對疼痛有反應" | "無反應";
}

export type ActionCategory = "安全" | "評估" | "問診" | "處置" | "運送";

export interface ScenarioAction {
  id: string;
  label: string;
  category: ActionCategory;
  timeCost: number;
  points: number;
  stabilityDelta: number;
  feedback: string;
}

export interface Scenario {
  id: string;
  title: string;
  callSign: string;
  dispatch: string;
  location: string;
  scene: string;
  patient: string;
  chiefComplaint: string;
  initialVitals: VitalSigns;
  actions: ScenarioAction[];
  requiredActionIds: string[];
  criticalActionIds: string[];
  clinicalNote: string;
  learningPoints: string[];
}

export interface ActionLog {
  id: string;
  label: string;
  feedback: string;
  scoreDelta: number;
  elapsed: number;
}

export interface ScenarioState {
  elapsed: number;
  stability: number;
  score: number;
  completedActionIds: string[];
  log: ActionLog[];
}

export interface ScenarioResult {
  scenarioId: string;
  score: number;
  stability: number;
  elapsed: number;
  missingRequiredIds: string[];
  grade: "S" | "A" | "B" | "C";
}

export type DecisionTag = "最佳判斷" | "可接受" | "危險" | "延誤";

export interface DecisionOption {
  id: string;
  label: string;
  rationale: string;
  timeCost: number;
  scoreDelta: number;
  stabilityDelta: number;
  tag: DecisionTag;
  finding?: string;
  nextNodeId: string | null;
}

export interface DecisionNode {
  id: string;
  phase: "抵達現場" | "初步評估" | "重點評估" | "立即處置" | "運送決策";
  prompt: string;
  situation: string;
  timeLimit: number;
  options: DecisionOption[];
}

export interface DecisionScenario {
  id: string;
  title: string;
  callSign: string;
  dispatch: string;
  location: string;
  patient: string;
  chiefComplaint: string;
  initialVitals: VitalSigns;
  startNodeId: string;
  nodes: DecisionNode[];
  learningPoints: string[];
}

export interface DecisionHistoryEntry {
  nodeId: string;
  optionId: string;
  label: string;
  rationale: string;
  tag: DecisionTag;
  elapsed: number;
  scoreDelta: number;
}

export interface DecisionState {
  currentNodeId: string | null;
  elapsed: number;
  stability: number;
  score: number;
  findings: string[];
  history: DecisionHistoryEntry[];
  status: "active" | "transported" | "critical";
}

export interface DecisionResult {
  scenarioId: string;
  score: number;
  stability: number;
  elapsed: number;
  bestChoices: number;
  dangerousChoices: number;
  grade: "S" | "A" | "B" | "C";
  outcome: string;
}

export type AssessmentKey =
  | "appearance"
  | "skin"
  | "injuries"
  | "bleeding"
  | "airway"
  | "breathing"
  | "respiratoryRate"
  | "pulse"
  | "bloodPressure"
  | "spo2"
  | "temperature"
  | "glucose"
  | "gcs"
  | "history"
  | "sampleHistory"
  | "opqrst"
  | "stroke";

export interface Environment {
  location: string;
  weather: string;
  ambientTemperature: number;
  timeOfDay: string;
  hazards: string[];
  hazardControlTime: number;
}

export interface Physiology {
  pulse: number;
  respiratoryRate: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  bodyTemperature: number;
  glucose: number;
  perfusion: number;
  oxygenation: number;
  bleedingRate: number;
  consciousness: number;
}

export type SimulationActionKind =
  | "assessment"
  | "instrument"
  | "treatment"
  | "transport";

export interface SimulationAction {
  id: string;
  label: string;
  category: ActionCategory;
  kind: SimulationActionKind;
  duration: number;
  description: string;
  reveals?: AssessmentKey[];
  repeatable?: boolean;
}

export type CaseTier = "intro" | "intermediate" | "advanced";

export interface SimulationScenario {
  id: string;
  title: string;
  callSign: string;
  dispatch: string;
  patient: string;
  age: number;
  chiefComplaint: string;
  caseTier: CaseTier;
  environment: Environment;
  initialPhysiology: Physiology;
  trends: Partial<Record<keyof Physiology, number>>;
  observations: Partial<Record<AssessmentKey, string>>;
  recommendedActionIds: string[];
  dangerousActionIds: string[];
  transportDestination: string;
  criticalFactors: string[];
  learningPoints: string[];
}

export interface Measurement {
  key: AssessmentKey;
  value: string;
  measuredAt: number;
}

export interface SimulationLog {
  id: string;
  label: string;
  message: string;
  elapsed: number;
  tone: "good" | "neutral" | "danger";
}

export interface SimulationState {
  elapsed: number;
  physiology: Physiology;
  revealed: AssessmentKey[];
  measurements: Partial<Record<AssessmentKey, Measurement>>;
  completedActionIds: string[];
  activeTreatments: string[];
  score: number;
  log: SimulationLog[];
  status: "active" | "transported" | "arrest" | "dead";
  resuscitationFailures: number;
  playerReport: {
    gcs?: {
      eye: number;
      verbal: number;
      motor: number;
      total: number;
    };
    transportReason?: string;
    transportIndicators?: string[];
  };
}

export interface ProcedureResolution {
  duration: number;
  scoreModifier: number;
  message: string;
  physiologyDelta?: Partial<Physiology>;
  playerGcs?: {
    eye: number;
    verbal: number;
    motor: number;
    total: number;
  };
  transportReason?: string;
  transportIndicators?: string[];
  appliedActionId?: string;
}
