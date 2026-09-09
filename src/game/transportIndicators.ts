import type { SimulationScenario, SimulationState } from "./types";

export interface TransportIndicatorOption {
  id: string;
  label: string;
  detail: string;
  group: "生理監控";
}

/** Instrument / assessment vitals only — no findings or system critical criteria. */
export function buildTransportIndicatorOptions(
  _scenario: SimulationScenario,
  state: SimulationState,
): TransportIndicatorOption[] {
  const options: TransportIndicatorOption[] = [];
  const push = (id: string, label: string, detail: string) => {
    if (!detail || detail === "未量測") return;
    options.push({ id, label, detail, group: "生理監控" });
  };

  if (state.measurements.pulse) {
    push("pulse", "脈搏", state.measurements.pulse.value);
  }
  if (state.measurements.respiratoryRate) {
    push("respiratoryRate", "呼吸", state.measurements.respiratoryRate.value);
  }
  if (state.measurements.bloodPressure) {
    push("bloodPressure", "血壓", state.measurements.bloodPressure.value);
  }
  if (state.measurements.spo2) {
    push("spo2", "SpO₂", state.measurements.spo2.value);
  }
  if (state.measurements.glucose) {
    push("glucose", "血糖", state.measurements.glucose.value);
  }
  if (state.measurements.gcs) {
    push("gcs", "GCS", state.measurements.gcs.value);
  } else if (state.playerReport.gcs) {
    const g = state.playerReport.gcs;
    push(
      "player-gcs",
      "GCS（玩家評分）",
      `E${g.eye} V${g.verbal} M${g.motor}＝${g.total}`,
    );
  }

  return options;
}
