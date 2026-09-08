import { describe, expect, it } from "vitest";
import { actionById, simulationActions } from "./actions";
import { simulationScenarios } from "./simulationScenarios";

describe("simulation content", () => {
  it("ships fifty distinct dynamic cases", () => {
    expect(simulationScenarios).toHaveLength(50);
    expect(new Set(simulationScenarios.map((item) => item.id)).size).toBe(50);
  });

  it("offers assessment, instruments, treatments and destinations", () => {
    expect(simulationActions.filter((item) => item.kind === "instrument").length).toBeGreaterThanOrEqual(4);
    expect(simulationActions.filter((item) => item.kind === "treatment").length).toBeGreaterThanOrEqual(12);
    expect(simulationActions.filter((item) => item.kind === "transport").length).toBeGreaterThanOrEqual(4);
  });

  it.each(simulationScenarios)("$title has valid environment and action rules", (scenario) => {
    expect(scenario.environment.location).not.toBe("");
    expect(scenario.environment.weather).not.toBe("");
    expect(scenario.environment.ambientTemperature).toBeGreaterThan(-10);
    expect(scenario.environment.hazards.length).toBeGreaterThan(0);
    expect(scenario.criticalFactors.length).toBeGreaterThanOrEqual(3);
    expect(scenario.learningPoints.length).toBeGreaterThanOrEqual(3);
    expect(actionById[scenario.transportDestination]).toBeDefined();
    for (const actionId of [
      ...scenario.recommendedActionIds,
      ...scenario.dangerousActionIds,
    ]) {
      expect(actionById[actionId]).toBeDefined();
    }
  });
});
