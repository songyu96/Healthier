import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "../meals/types";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { BASE_FOODS } from "../nutrition/foodData";
import { BUILT_IN_FOODS } from "../nutrition/foodRegistry";
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

function mealWithFoods(id: string, date: string, foodIds: string[]): ConfirmedMeal {
  return {
    id,
    protocolVersion: "HD1",
    eatenAt: `${date}T12:00:00`,
    date,
    mealType: "L",
    cookingMethod: "MIXED",
    note: "",
    rawImportLine: "test",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "book-rules-0.1",
    createdAt: `${date}T12:01:00`,
    updatedAt: `${date}T12:01:00`,
    items: foodIds.map((foodId, index) => {
      const food = BUILT_IN_FOODS.find((candidate) => candidate.id === foodId);
      if (!food) throw new Error(`测试食物不存在：${foodId}`);
      return {
        tempId: `${id}-${index}`,
        name: food.name,
        category: food.category,
        state: food.compatibleStates[0],
        quantityMin: 100,
        quantityMax: 100,
        unit: food.basisUnit,
        canonicalFoodId: food.id
      };
    })
  };
}

function assessMeal(meal: ConfirmedMeal) {
  const facts = calculateNutrition(meal, BUILT_IN_FOODS);
  return {
    facts,
    assessment: assessDay(meal.date, [{ meal, facts }], targets, { completed: true, waterMl: 0 })
  };
}

describe("ingredient diversity normalization", () => {
  it("主要原料同为小麦的面包和面条只计一种", () => {
    const meal: ConfirmedMeal = {
      id: "wheat-products",
      protocolVersion: "HD1",
      eatenAt: "2026-08-25T12:00:00",
      date: "2026-08-25",
      mealType: "L",
      cookingMethod: "MIXED",
      note: "",
      rawImportLine: "test",
      unknownOil: false,
      unknownSalt: false,
      ruleSetVersion: "book-rules-0.1",
      createdAt: "2026-08-25T12:01:00",
      updatedAt: "2026-08-25T12:01:00",
      items: [
        { tempId: "bread", name: "全麦面包", category: "WG", state: "EA", quantityMin: 20, quantityMax: 20, unit: "g", canonicalFoodId: "bread-whole-wheat" },
        { tempId: "noodles", name: "面条", category: "GR", state: "CK", quantityMin: 100, quantityMax: 100, unit: "g", canonicalFoodId: "egg-noodles-cooked" }
      ]
    };
    const result = assessDay(
      meal.date,
      [{ meal, facts: calculateNutrition(meal, BASE_FOODS) }],
      targets,
      { completed: true, waterMl: 0 }
    );

    expect(result.foodVarietyCount).toBe(1);
  });

  it("常见同食材的不同形态各只计一种且营养值仍逐项汇总", () => {
    const foodIds = [
      "bread-whole-wheat", "mantou-generic-recipe",
      "rice-white-cooked", "congee-plain-current",
      "potato-boiled", "french-fries-fast-food-current",
      "soybeans-cooked", "tofu-firm",
      "chicken-breast-roasted", "chicken-thigh-roasted-current",
      "pork-loin-roasted", "pork-belly-raw",
      "milk-whole", "yogurt-plain",
      "orange-raw", "orange-juice-100-current"
    ];
    const meal = mealWithFoods("same-ingredients", "2026-08-25", foodIds);
    const { facts, assessment } = assessMeal(meal);
    const expectedKcal = foodIds.reduce((sum, foodId) => {
      const food = BUILT_IN_FOODS.find((candidate) => candidate.id === foodId);
      return sum + (food?.nutrientsPer100?.kcal ?? 0);
    }, 0);

    expect(assessment.foodVarietyCount).toBe(8);
    expect(facts.knownItemCount).toBe(foodIds.length);
    expect(facts.totals.min.kcal).toBeCloseTo(expectedKcal);
    expect(assessment.nutrition).toEqual(facts.totals);
  });

  it("同一食材跨天记录在周总结中仍只计一种", () => {
    const first = assessMeal(mealWithFoods("rice", "2026-08-24", ["rice-white-cooked"])).assessment;
    const second = assessMeal(mealWithFoods("congee", "2026-08-25", ["congee-plain-current"])).assessment;

    const week = assessWeek("2026-08-19", "2026-08-25", [first, second], []);

    expect(first.foodVarietyCount).toBe(1);
    expect(second.foodVarietyCount).toBe(1);
    expect(week.uniqueFoodCount).toBe(1);
  });

  it("通用牛奶和三元纯牛奶同日只计一种且营养分别累加", () => {
    const foodIds = ["milk-whole", "china-sanyuan-whole-milk-sample"];
    const { facts, assessment } = assessMeal(mealWithFoods("two-milks", "2026-08-25", foodIds));
    const expectedKcal = foodIds.reduce((sum, foodId) => {
      const food = BUILT_IN_FOODS.find((candidate) => candidate.id === foodId);
      return sum + (food?.nutrientsPer100?.kcal ?? 0);
    }, 0);

    expect(assessment.foodVarietyCount).toBe(1);
    expect(facts.knownItemCount).toBe(2);
    expect(facts.totals.min.kcal).toBeCloseTo(expectedKcal);
    expect(assessment.nutrition).toEqual(facts.totals);
  });

  it("通用牛奶和三元纯牛奶跨天在周总结中只计一种", () => {
    const first = assessMeal(mealWithFoods("milk", "2026-08-24", ["milk-whole"])).assessment;
    const second = assessMeal(mealWithFoods(
      "sanyuan-milk",
      "2026-08-25",
      ["china-sanyuan-whole-milk-sample"]
    )).assessment;

    const week = assessWeek("2026-08-19", "2026-08-25", [first, second], []);

    expect(week.uniqueFoodCount).toBe(1);
  });
});
