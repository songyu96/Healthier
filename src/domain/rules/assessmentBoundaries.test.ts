import { describe, expect, it } from "vitest";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { BASE_FOODS } from "../nutrition/foodData";
import type { ConfirmedMeal } from "../meals/types";
import { assessDay } from "./assessDay";
import { assessWeek } from "./assessWeek";
import { recommendNextMeal } from "./recommendations";
import { calculateTargets } from "./targets";

const targets = calculateTargets({
  id: "default",
  birthDate: "1990-01-01",
  dietPattern: "OMNIVORE",
  heightCm: 175,
  currentWeightKg: 70,
  activityLevel: "LIGHT",
  overweightAdjustmentEnabled: false,
  healthFlags: [],
  updatedAt: "2026-08-25T00:00:00"
});

function mealWithJuice(): ConfirmedMeal {
  return {
    id: "juice",
    protocolVersion: "HD1",
    eatenAt: "2026-08-25T10:00:00",
    date: "2026-08-25",
    mealType: "S",
    items: [{
      tempId: "juice-item",
      name: "苹果汁",
      category: "SD",
      state: "PK",
      quantityMin: 250,
      quantityMax: 250,
      unit: "ml"
    }],
    cookingMethod: "NONE",
    note: "油量未知",
    rawImportLine: "test",
    unknownOil: true,
    unknownSalt: false,
    ruleSetVersion: targets.ruleSetVersion,
    createdAt: "2026-08-25T10:00:00",
    updatedAt: "2026-08-25T10:00:00"
  };
}

describe("assessment boundaries", () => {
  it("果汁不计入鲜果目标，未知油脂不自动增加能量", () => {
    const meal = mealWithJuice();
    const assessment = assessDay(
      meal.date,
      [{ meal, facts: calculateNutrition(meal, BASE_FOODS) }],
      targets,
      { completed: true, waterMl: 0 }
    );

    expect(assessment.groups.fruit).toEqual({ min: 0, max: 0 });
    expect(assessment.nutrition.min.kcal).toBe(0);
    expect(assessment.nutrition.max.kcal).toBe(0);
    expect(assessment.warnings.join(" ")).toContain("油量未知");
    expect(assessment.nutritionComplete).toBe(false);
    const actions = recommendNextMeal(assessment);
    expect(actions.map((action) => action.id)).not.toContain("protein-gap");
  });

  it("早餐最低分必须大于60才计为周达标", () => {
    const base = assessDay("2026-08-25", [], targets, { completed: true, waterMl: 0 });
    const exactSixty = assessWeek(
      "2026-08-19",
      "2026-08-25",
      [{ ...base, breakfastScore: { min: 60, max: 60 } }],
      []
    );
    const aboveSixty = assessWeek(
      "2026-08-19",
      "2026-08-25",
      [{ ...base, breakfastScore: { min: 60.01, max: 60.01 } }],
      []
    );
    expect(exactSixty.breakfastPassDays).toBe(0);
    expect(aboveSixty.breakfastPassDays).toBe(1);
  });

  it("内置食物库至少40种且每项保留真实来源标识", () => {
    expect(BASE_FOODS.length).toBeGreaterThanOrEqual(40);
    expect(BASE_FOODS.every((food) => food.source.ref.startsWith("SR28:") && food.source.release.length > 0)).toBe(true);
  });
});
