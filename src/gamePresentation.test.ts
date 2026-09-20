import { describe, expect, it } from "vitest";
import { avatarProportions, swimPresentation } from "./gamePresentation";
import type { GameDietDay } from "./game";

const assessedDiet: GameDietDay = {
  date: "2026-08-26",
  status: "ASSESSED",
  score: 0.5,
  evaluableIndicators: 2,
  passedIndicators: 1
};

describe("ocean swim presentation", () => {
  it("休息日仍巡游，打卡贡献提高划水节奏", () => {
    expect(swimPresentation(0).pace).toBe("EASY");
    expect(swimPresentation(8).pace).toBe("STEADY");
    expect(swimPresentation(20).pace).toBe("SURGE");
  });

  it("只有可评价且达到门槛的饮食结构点亮水下光效", () => {
    expect(swimPresentation(0, assessedDiet).luminousWater).toBe(true);
    expect(swimPresentation(0, { ...assessedDiet, score: 0 }).luminousWater).toBe(false);
    expect(swimPresentation(0, { ...assessedDiet, status: "UNASSESSED" }).luminousWater).toBe(false);
    expect(swimPresentation(0, { ...assessedDiet, status: "SAFETY_PAUSED" }).luminousWater).toBe(false);
  });

  it("身高体重只产生有边界的外观差异", () => {
    const shorter = avatarProportions({ heightCm: 150, currentWeightKg: 50 });
    const taller = avatarProportions({ heightCm: 190, currentWeightKg: 90 });
    expect(shorter.bodyWidth).toBeLessThan(taller.bodyWidth);
    expect(shorter.strokeReach).toBeLessThan(taller.strokeReach);
    expect(avatarProportions({ heightCm: 100, currentWeightKg: 1 }).bodyWidth).toBeGreaterThanOrEqual(0.88);
    expect(avatarProportions({ heightCm: 250, currentWeightKg: 300 }).strokeReach).toBeLessThanOrEqual(1.08);
  });
});
