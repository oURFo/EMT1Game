import { describe, expect, it } from "vitest";
import { actionById } from "../data/actions";
import { simulationScenarios } from "../data/simulationScenarios";
import { DIFFICULTIES } from "./engine";
import {
  advanceWithoutAction,
  assessCriticalCase,
  createSimulationState,
  getActionDuration,
  measurementIsStale,
  performSimulationAction,
} from "./simulationEngine";

describe("dynamic patient simulation", () => {
  it("keeps values hidden until the matching assessment", () => {
    const scenario = simulationScenarios[1];
    const initial = createSimulationState(scenario);
    expect(initial.measurements.spo2).toBeUndefined();

    const measured = performSimulationAction(
      scenario,
      initial,
      actionById["pulse-ox"],
      DIFFICULTIES.standard,
    );
    expect(measured.measurements.spo2?.value).toMatch(/%/);
  });

  it("changes physiology as time passes", () => {
    const scenario = simulationScenarios[1];
    const initial = createSimulationState(scenario);
    const later = advanceWithoutAction(
      scenario,
      initial,
      120,
      DIFFICULTIES.standard,
    );

    expect(later.physiology.spo2).toBeLessThan(initial.physiology.spo2);
    expect(later.physiology.oxygenation).toBeLessThan(
      initial.physiology.oxygenation,
    );
  });

  it("lets treatment alter subsequent patient trends", () => {
    const scenario = simulationScenarios[0];
    const initial = createSimulationState(scenario);
    const treated = performSimulationAction(
      scenario,
      initial,
      actionById["direct-pressure"],
      DIFFICULTIES.standard,
    );

    expect(treated.physiology.bleedingRate).toBeLessThan(
      initial.physiology.bleedingRate,
    );
    expect(treated.activeTreatments).toContain("direct-pressure");
  });

  it("marks old instrument readings stale", () => {
    expect(
      measurementIsStale(
        { key: "spo2", value: "92 %", measuredAt: 30 },
        120,
      ),
    ).toBe(true);
  });

  it("applies consequences to contraindicated actions", () => {
    const scenario = simulationScenarios[4];
    const initial = createSimulationState(scenario);
    const harmed = performSimulationAction(
      scenario,
      initial,
      actionById.blanket,
      DIFFICULTIES.standard,
    );

    expect(harmed.physiology.bodyTemperature).toBeGreaterThan(
      initial.physiology.bodyTemperature,
    );
    expect(harmed.log[0].tone).toBe("danger");
  });

  it("uses scene-specific time to control hazards", () => {
    const trauma = simulationScenarios[0];
    const stroke = simulationScenarios[5];
    expect(
      getActionDuration(trauma, actionById["control-hazards"]),
    ).toBe(42);
    expect(
      getActionDuration(stroke, actionById["control-hazards"]),
    ).toBe(38);
  });

  it("returns a concrete answer for airway assessment", () => {
    const scenario = simulationScenarios[5];
    const initial = createSimulationState(scenario);
    const result = performSimulationAction(
      scenario,
      initial,
      actionById["check-airway"],
      DIFFICULTIES.standard,
    );

    expect(result.log[0].message).toContain("呼吸道");
    expect(result.log[0].message).toContain("構音不清");
  });

  it("records repeatable AVPU and reports the complete scale", () => {
    const scenario = simulationScenarios[3];
    const result = performSimulationAction(
      scenario,
      createSimulationState(scenario),
      actionById["check-response"],
      DIFFICULTIES.standard,
    );

    expect(result.completedActionIds).toContain("check-response");
    expect(result.log[0].message).toContain("A－");
    expect(result.log[0].message).toContain("V－");
    expect(result.log[0].message).toContain("P－");
    expect(result.log[0].message).toContain("U－");
  });

  it("returns different SAMPLE and OPQRST findings", () => {
    const scenario = simulationScenarios[2];
    const initial = createSimulationState(scenario);
    const sampleResult = performSimulationAction(
      scenario,
      initial,
      actionById.sample,
      DIFFICULTIES.standard,
    );
    const opqrstResult = performSimulationAction(
      scenario,
      initial,
      actionById.opqrst,
      DIFFICULTIES.standard,
    );

    expect(sampleResult.log[0].message).toContain("A：");
    expect(opqrstResult.log[0].message).toContain("O：");
    expect(sampleResult.log[0].message).not.toBe(opqrstResult.log[0].message);
  });

  it("writes interactive procedure timing, feedback and GCS to state", () => {
    const scenario = simulationScenarios[3];
    const result = performSimulationAction(
      scenario,
      createSimulationState(scenario),
      actionById["gcs-assessment"],
      DIFFICULTIES.standard,
      {
        duration: 52,
        scoreModifier: 24,
        message: "GCS 判斷正確。",
        playerGcs: { eye: 3, verbal: 4, motor: 5, total: 12 },
      },
    );

    expect(result.elapsed).toBe(52);
    expect(result.measurements.gcs?.value).toMatch(/^E\d V\d M\d＝\d+$/);
    expect(result.log[0].message).toContain("GCS 判斷正確");
    expect(result.playerReport.gcs?.total).toBe(12);
  });

  it("persists the player's critical transport reason", () => {
    const scenario = simulationScenarios[0];
    const result = performSimulationAction(
      scenario,
      createSimulationState(scenario),
      actionById["transport-trauma"],
      DIFFICULTIES.standard,
      {
        duration: 45,
        scoreModifier: 8,
        message: "送醫紀錄完成。",
        transportReason: "大量外出血合併休克徵象，需要高優先送醫。",
      },
    );

    expect(result.status).toBe("transported");
    expect(result.playerReport.transportReason).toContain("休克");
  });

  it("explains matched EMT critical-case thresholds", () => {
    const scenario = simulationScenarios.find(
      (item) => item.id === "breathing-asthma",
    )!;
    const assessment = assessCriticalCase(
      scenario,
      createSimulationState(scenario),
    );

    expect(assessment.classification).toBe("危急個案");
    expect(assessment.criteria.some((item) => item.standard.includes("呼吸頻率"))).toBe(true);
    expect(assessment.criteria.some((item) => item.standard.includes("SpO₂"))).toBe(true);
    expect(assessment.urgentReason).toContain("儘速");
  });

  it("classifies cardiac arrest as prehospital level one", () => {
    const scenario = simulationScenarios.find(
      (item) => item.id === "arrest-gym",
    )!;
    expect(
      assessCriticalCase(scenario, createSimulationState(scenario))
        .classification,
    ).toBe("一級危急");
  });
});
