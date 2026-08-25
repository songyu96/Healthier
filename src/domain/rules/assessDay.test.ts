import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "../meals/types";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { BASE_FOODS } from "../nutrition/foodData";
import { assessDay } from "./assessDay";
import { recommendNextMeal } from "./recommendations";
import { calculateTargets } from "./targets";

const profile = {
  id: "default" as const,
  birthDate: "1990-01-01",
  dietPattern: "OMNIVORE" as const,
  heightCm: 175,
  currentWeightKg: 72,
  activityLevel: "LIGHT" as const,
  overweightAdjustmentEnabled: false,
  healthFlags: [],
  updatedAt: "2026-08-24T00:00:00"
};

function breakfast(): ConfirmedMeal {
  return {
    id: "breakfast",
    protocolVersion: "HD1",
    eatenAt: "2026-08-24T07:30:00",
    date: "2026-08-24",
    mealType: "B",
    items: [
      { tempId: "bread", name: "全麦面包", category: "WG", state: "EA", quantityMin: 100, quantityMax: 100, unit: "g" },
      { tempId: "egg", name: "鸡蛋", category: "EG", state: "EA", quantityMin: 2, quantityMax: 2, unit: "pc" },
      { tempId: "tomato", name: "西红柿", category: "DV", state: "EA", quantityMin: 100, quantityMax: 100, unit: "g" },
      { tempId: "apple", name: "苹果", category: "FR", state: "EA", quantityMin: 150, quantityMax: 150, unit: "g" },
      { tempId: "nuts", name: "核桃仁", category: "NS", state: "EA", quantityMin: 15, quantityMax: 15, unit: "g" }
    ],
    cookingMethod: "MIXED",
    note: "",
    rawImportLine: "test",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "book-rules-0.1",
    createdAt: "2026-08-24T07:31:00",
    updatedAt: "2026-08-24T07:31:00"
  };
}

describe("assessDay", () => {
  it("早餐五类齐全时获得50分结构分并保留能量范围", () => {
    const meal = breakfast();
    const facts = calculateNutrition(meal, BASE_FOODS);
    const assessment = assessDay(
      meal.date,
      [{ meal, facts }],
      calculateTargets(profile),
      { completed: false, waterMl: 500 }
    );
    expect(assessment.breakfastScore?.min).toBeGreaterThanOrEqual(50);
    expect(assessment.foodVarietyCount).toBe(5);
  });

  it("推荐最多三项且优先补主要缺口", () => {
    const assessment = assessDay(
      "2026-08-24",
      [],
      calculateTargets(profile),
      { completed: false, waterMl: 0 }
    );
    const actions = recommendNextMeal(assessment);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(actions[0].id).toBe("vegetable-gap");
  });

  it("未知熟重不计入可比较食物组克数", () => {
    const meal = breakfast();
    meal.items = [{
      tempId: "unknown-veg",
      name: "自家种青菜",
      category: "LV",
      state: "CK",
      quantityMin: 80,
      quantityMax: 120,
      unit: "g"
    }];
    const facts = calculateNutrition(meal, BASE_FOODS);
    const assessment = assessDay(meal.date, [{ meal, facts }], calculateTargets(profile), { completed: true, waterMl: 0 });

    expect(assessment.unknownNutritionCount).toBe(1);
    expect(assessment.nutrition.min.kcal).toBe(0);
    expect(assessment.groups.vegetable).toEqual({ min: 0, max: 0 });
    expect(assessment.incomparableGroups).toContain("vegetable");
    expect(recommendNextMeal(assessment).map((action) => action.id)).not.toContain("vegetable-gap");
  });
});
