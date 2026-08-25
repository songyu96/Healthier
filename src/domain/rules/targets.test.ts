import { describe, expect, it } from "vitest";
import { calculateTargets } from "./targets";
import type { UserProfile } from "./types";

function profile(heightCm: number): UserProfile {
  return {
    id: "default",
    birthDate: "1990-01-01",
    dietPattern: "OMNIVORE",
    dailyExercise: "NONE",
    dietHabitSummary: "三餐规律",
    heightCm,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags: [],
    updatedAt: "2026-08-25T00:00:00"
  };
}

describe("calculateTargets", () => {
  it.each([
    [175, 70, 2100, 78.75, 70],
    [178, 73, 2190, 82.125, 73],
    [185, 80, 2400, 90, 80]
  ])("复现书中身高%s厘米案例", (height, standardWeight, energy, protein, fat) => {
    const result = calculateTargets(profile(height));
    expect(result.standardWeightKg).toBe(standardWeight);
    expect(result.energyKcal).toBe(energy);
    expect(result.proteinG).toBeCloseTo(protein, 3);
    expect(result.fatG).toBeCloseTo(fat, 3);
  });

  it("只在用户主动开启时采用轻体力超重调整", () => {
    const input = profile(175);
    input.overweightAdjustmentEnabled = true;
    const result = calculateTargets(input);
    expect(result.activityFactor).toBe(25);
    expect(result.energyKcal).toBe(1750);
  });

  it("特殊健康标记触发安全门但仍展示书本估算", () => {
    const input = profile(175);
    input.healthFlags = ["DISEASE", "MEDICATION"];
    const result = calculateTargets(input);
    expect(result.energyKcal).toBe(2100);
    expect(result.safetyRestricted).toBe(true);
    expect(result.safetyMessages).toHaveLength(2);
  });
});

