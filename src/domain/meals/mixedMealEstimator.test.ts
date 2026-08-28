import { describe, expect, it } from "vitest";
import { COMMON_FOODS } from "../nutrition/commonFoodData";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { assessDay } from "../rules/assessDay";
import { calculateTargets } from "../rules/targets";
import { createMixedMealDraft } from "./mixedMealEstimator";

describe("mixed meal estimator", () => {
  it("按畜禽肉、鱼虾、蛋、蔬菜、谷物、薯类和豆制品生成正确分类", () => {
    const draft = createMixedMealDraft({
      kind: "HOTPOT",
      eatenAt: "2026-08-27T19:00:00",
      mealType: "D",
      meatG: 180,
      fishG: 90,
      eggG: 50,
      vegetableG: 250,
      grainG: 100,
      tuberG: 80,
      soyG: 80,
      seasoningLevel: "NORMAL"
    });

    expect(draft.items).toHaveLength(7);
    expect(draft.items.map((item) => item.category)).toEqual(["MP", "FI", "EG", "LV", "GR", "TU", "SO"]);
    expect(draft.items[0]).toMatchObject({ quantityMin: 180, quantityMax: 180, state: "CK" });
    expect(draft.rawImportLine).toContain("HD1|20260827-1900|D|");
    expect(draft.items.some((item) => item.category === "OI")).toBe(false);
    expect(draft.unknownOil).toBe(true);
    expect(draft.unknownSalt).toBe(true);
  });

  it("营养估算进入区间且保留配方计算标记", () => {
    const draft = createMixedMealDraft({
      kind: "BARBECUE",
      eatenAt: "2026-08-27T20:00:00",
      mealType: "D",
      meatG: 200,
      fishG: 0,
      eggG: 0,
      vegetableG: 100,
      grainG: 0,
      tuberG: 0,
      soyG: 0,
      seasoningLevel: "HEAVY"
    });
    const facts = calculateNutrition({ id: "barbecue", items: draft.items }, COMMON_FOODS);

    expect(facts.complete).toBe(true);
    expect(facts.totals.min.kcal).toBeGreaterThan(0);
    expect(facts.totals.max.kcal).toBe(facts.totals.min.kcal);
    expect(facts.items.every((item) => item.calculationBasis === "RECIPE")).toBe(true);

    const meal = {
      ...draft,
      id: "barbecue",
      ruleSetVersion: "book-rules-0.1",
      createdAt: "2026-08-27T20:01:00",
      updatedAt: "2026-08-27T20:01:00"
    };
    const targets = calculateTargets({
      id: "default", birthDate: "1990-01-01", dietPattern: "OMNIVORE", dailyExercise: "NONE",
      dietHabitSummary: "三餐规律", heightCm: 175, currentWeightKg: 70, activityLevel: "LIGHT",
      overweightAdjustmentEnabled: false, healthFlags: [], updatedAt: "2026-08-27T08:00:00"
    });
    const assessment = assessDay("2026-08-27", [{ meal, facts }], targets, { completed: false, waterMl: 0 });
    expect(assessment.warnings.join(" ")).toContain("通用配方或组合餐估值");
  });
});
