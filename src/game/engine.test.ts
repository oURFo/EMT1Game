import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import {
  createScenarioState,
  DIFFICULTIES,
  finishScenario,
  performAction,
} from "./engine";

const scenario = scenarios[0];

describe("scenario engine", () => {
  it("applies an action only once", () => {
    const initial = createScenarioState();
    const first = performAction(
      scenario,
      initial,
      "scene-safety",
      DIFFICULTIES.standard,
    );
    const duplicate = performAction(
      scenario,
      first,
      "scene-safety",
      DIFFICULTIES.standard,
    );

    expect(first.score).toBeGreaterThan(0);
    expect(duplicate).toBe(first);
  });

  it("penalizes unsafe actions", () => {
    const initial = createScenarioState();
    const next = performAction(
      scenario,
      initial,
      "remove-glass",
      DIFFICULTIES.standard,
    );

    expect(next.stability).toBeLessThan(initial.stability);
    expect(next.score).toBe(0);
  });

  it("reports missing required actions at transport", () => {
    const result = finishScenario(scenario, createScenarioState());

    expect(result.missingRequiredIds).toHaveLength(
      scenario.requiredActionIds.length,
    );
    expect(result.grade).toBe("C");
  });

  it("rewards completion of the correct sequence", () => {
    const completed = scenario.requiredActionIds.reduce(
      (state, actionId) =>
        performAction(scenario, state, actionId, DIFFICULTIES.standard),
      createScenarioState(),
    );
    const result = finishScenario(scenario, completed);

    expect(result.missingRequiredIds).toEqual([]);
    expect(result.score).toBeGreaterThan(90);
  });
});
