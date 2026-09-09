import { assessCriticalCase, getGcsDisplay, getObservation } from "./simulationEngine";
import type { SimulationScenario, SimulationState } from "./types";

export interface TransportIndicatorOption {
  id: string;
  label: string;
  detail: string;
  group: "生命徵象" | "評估發現" | "危急標準";
}

export function buildTransportIndicatorOptions(
  scenario: SimulationScenario,
  state: SimulationState,
): TransportIndicatorOption[] {
  const options: TransportIndicatorOption[] = [];
  const push = (
    id: string,
    label: string,
    detail: string,
    group: TransportIndicatorOption["group"],
  ) => {
    if (!detail || detail === "未量測") return;
    options.push({ id, label, detail, group });
  };

  if (state.measurements.pulse) {
    push("pulse", "脈搏", state.measurements.pulse.value, "生命徵象");
  }
  if (state.measurements.respiratoryRate) {
    push("respiratoryRate", "呼吸", state.measurements.respiratoryRate.value, "生命徵象");
  }
  if (state.measurements.bloodPressure) {
    push("bloodPressure", "血壓", state.measurements.bloodPressure.value, "生命徵象");
  }
  if (state.measurements.spo2) {
    push("spo2", "SpO₂", state.measurements.spo2.value, "生命徵象");
  }
  if (state.measurements.temperature) {
    push("temperature", "體溫", state.measurements.temperature.value, "生命徵象");
  }
  if (state.measurements.glucose) {
    push("glucose", "血糖", state.measurements.glucose.value, "生命徵象");
  }
  if (state.measurements.gcs) {
    push("gcs", "GCS", state.measurements.gcs.value, "生命徵象");
  } else if (state.playerReport.gcs) {
    const g = state.playerReport.gcs;
    push(
      "player-gcs",
      "玩家 GCS",
      `E${g.eye} V${g.verbal} M${g.motor}＝${g.total}`,
      "生命徵象",
    );
  }
  if (state.completedActionIds.includes("check-response")) {
    push(
      "avpu",
      "意識 AVPU",
      getObservation(scenario, state, "appearance"),
      "評估發現",
    );
  }

  for (const key of [
    "skin",
    "airway",
    "breathing",
    "injuries",
    "bleeding",
    "sampleHistory",
    "opqrst",
    "stroke",
  ] as const) {
    if (state.revealed.includes(key)) {
      const labels: Record<string, string> = {
        skin: "膚色與皮膚",
        airway: "呼吸道",
        breathing: "呼吸觀察",
        injuries: "傷處",
        bleeding: "出血",
        sampleHistory: "SAMPLE 病史",
        opqrst: "OPQRST",
        stroke: "神經學評估",
      };
      push(key, labels[key], getObservation(scenario, state, key), "評估發現");
    }
  }

  push(
    "system-gcs",
    "送醫時 GCS",
    getGcsDisplay(state.physiology.consciousness),
    "生命徵象",
  );

  for (const criterion of assessCriticalCase(scenario, state).criteria) {
    options.push({
      id: `criterion-${criterion.standard}`,
      label: criterion.standard,
      detail: criterion.evidence,
      group: "危急標準",
    });
  }

  return options;
}
