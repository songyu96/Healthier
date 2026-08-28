import { describe, expect, it } from "vitest";
import type { DailyAssessment, RangeValue } from "./types";
import { assessDay } from "./assessDay";
import { assessWeek } from "./assessWeek";
import { calculateTargets } from "./targets";

const targets = calculateTargets({
  id: "default",
  heightCm: 175,
  currentWeightKg: 70,
  activityLevel: "LIGHT",
  overweightAdjustmentEnabled: false,
  healthFlags: [],
  updatedAt: "2026-08-25T00:00:00"
});

function range(min: number, max = min): RangeValue {
  return { min, max };
}

function day(index: number, overrides: Partial<DailyAssessment> = {}): DailyAssessment {
  const date = `2026-08-${String(19 + index).padStart(2, "0")}`;
  const base = assessDay(date, [], targets, { completed: true, waterMl: 0 });
  return {
    ...base,
    nutritionComplete: true,
    nutrition: {
      min: { kcal: 1800, protein: 70, fat: 50, carb: 250, fiber: 20 },
      max: { kcal: 2200, protein: 80, fat: 70, carb: 300, fiber: 30 }
    },
    groups: {
      ...base.groups,
      fish: range(40),
      meat: range(40),
      egg: range(40),
      animalFood: range(120),
      dairy: range(300)
    },
    foodNames: [`food-${index}`],
    foodVarietyCount: 1,
    breakfastScore: range(70),
    ...overrides
  };
}

describe("assessWeek", () => {
  it("七个完整且可比的记录日分别检查鱼肉蛋周目标", () => {
    const days = Array.from({ length: 7 }, (_, index) => day(index));
    days.forEach((current) => {
      current.groups.fish = range(0);
      current.groups.animalFood = range(80);
    });

    const result = assessWeek("2026-08-19", "2026-08-25", days, []);
    expect(result.fishTotal).toEqual(range(0));
    expect(result.meatTotal).toEqual(range(280));
    expect(result.eggTotal).toEqual(range(280));
    expect(result.issues.join(" ")).toContain("鱼虾明确低于");
    expect(result.issues.join(" ")).not.toContain("蛋类明确低于");
  });

  it("周区间与目标相交时不下确定不足结论", () => {
    const days = Array.from({ length: 7 }, (_, index) => day(index));
    days.forEach((current) => {
      current.groups.fish = range(35, 45);
      current.groups.animalFood = range(115, 125);
    });

    const result = assessWeek("2026-08-19", "2026-08-25", days, []);
    expect(result.fishTotal).toEqual(range(245, 315));
    expect(result.issues.join(" ")).not.toContain("鱼虾明确低于");
  });

  it("营养不完整比例过高时周平均只使用完整日", () => {
    const days = Array.from({ length: 4 }, (_, index) => day(index));
    days[0].nutritionComplete = false;
    days[1].nutritionComplete = false;

    const result = assessWeek("2026-08-19", "2026-08-25", days, []);
    expect(result.nutritionValidDays).toBe(2);
    expect(result.issues.join(" ")).toContain("可靠营养覆盖不足70%");
  });

  it("低置信度估算日不进入可靠周平均", () => {
    const days = Array.from({ length: 4 }, (_, index) => day(index));
    days[0].nutritionReliability = "LOW";

    const result = assessWeek("2026-08-19", "2026-08-25", days, []);
    expect(result.validDays).toBe(4);
    expect(result.nutritionValidDays).toBe(3);
    expect(result.issues.join(" ")).not.toContain("能量已知上限仍低于目标80%");
  });

  it("多数完整日能量和蛋白质明显不足时给出问题", () => {
    const days = Array.from({ length: 4 }, (_, index) => day(index));
    days.forEach((current) => {
      current.nutrition.max.kcal = 1000;
      current.nutrition.max.protein = 30;
    });

    const result = assessWeek("2026-08-19", "2026-08-25", days, []);
    expect(result.issues.join(" ")).toContain("能量已知上限仍低于目标80%");
    expect(result.issues.join(" ")).toContain("蛋白质已知上限仍低于目标80%");
  });

  it("体重变化只使用报告日期范围内记录", () => {
    const metrics = [
      { measuredAt: "2026-08-01T08:00:00", weightKg: 100 },
      { measuredAt: "2026-08-20T08:00:00", weightKg: 70 },
      { measuredAt: "2026-08-24T08:00:00", weightKg: 69 },
      { measuredAt: "2026-08-30T08:00:00", weightKg: 50 }
    ];
    const result = assessWeek("2026-08-19", "2026-08-25", [day(0)], metrics);

    expect(result.previousWeightKg).toBe(70);
    expect(result.latestWeightKg).toBe(69);
    expect(result.weightChangeKg).toBe(-1);
  });
});
