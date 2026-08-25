import { describe, expect, it } from "vitest";
import type { ConfirmedMeal, FoodReference, MealItemInput } from "..";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { BASE_FOODS } from "../nutrition/foodData";
import { assessDay } from "./assessDay";
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

function meal(items: MealItemInput[]): ConfirmedMeal {
  return {
    id: "group-meal",
    protocolVersion: "HD1",
    eatenAt: "2026-08-25T12:00:00",
    date: "2026-08-25",
    mealType: "L",
    items,
    cookingMethod: "MIXED",
    note: "",
    rawImportLine: "test",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: targets.ruleSetVersion,
    createdAt: "2026-08-25T12:01:00",
    updatedAt: "2026-08-25T12:01:00"
  };
}

function assess(input: ConfirmedMeal, foods: FoodReference[]) {
  return assessDay(
    input.date,
    [{ meal: input, facts: calculateNutrition(input, foods) }],
    targets,
    { completed: true, waterMl: 0 }
  );
}

const vegetable: FoodReference = {
  id: "test-vegetable",
  name: "测试青菜",
  aliases: [],
  category: "LV",
  compatibleStates: ["RW", "CK"],
  basisUnit: "g",
  nutrientsPer100: { kcal: 20, protein: 1, fat: 0, carb: 4, fiber: 2 },
  source: { kind: "USER", ref: "test", release: "2026-08-25" }
};

describe("food group basis and diversity", () => {
  it("只把生重加入书本蔬菜克数，熟重标记不可比", () => {
    const input = meal([
      { tempId: "raw", name: "测试青菜", category: "LV", state: "RW", quantityMin: 100, quantityMax: 100, unit: "g" },
      { tempId: "cooked", name: "测试青菜", category: "LV", state: "CK", quantityMin: 80, quantityMax: 80, unit: "g" }
    ]);
    const result = assess(input, [vegetable]);

    expect(result.groups.vegetable).toEqual({ min: 100, max: 100 });
    expect(result.incomparableGroups).toContain("vegetable");
  });

  it("非奶类毫升和酸奶克数不直接进入书本克数目标", () => {
    const yogurt = BASE_FOODS.find((food) => food.id === "yogurt-plain")!;
    const milk = BASE_FOODS.find((food) => food.id === "milk-whole")!;
    const input = meal([
      { tempId: "veg-ml", name: "测试青菜", category: "LV", state: "RW", quantityMin: 100, quantityMax: 100, unit: "ml" },
      { tempId: "yogurt", name: "原味酸奶", category: "DA", state: "EA", quantityMin: 300, quantityMax: 300, unit: "g", canonicalFoodId: yogurt.id },
      { tempId: "milk", name: "牛奶", category: "DA", state: "EA", quantityMin: 200, quantityMax: 200, unit: "ml", canonicalFoodId: milk.id }
    ]);
    const result = assess(input, [vegetable, yogurt, milk]);

    expect(result.groups.vegetable).toEqual({ min: 0, max: 0 });
    expect(result.groups.dairy).toEqual({ min: 200, max: 200 });
    expect(result.incomparableGroups).toEqual(expect.arrayContaining(["vegetable", "dairy"]));
  });

  it("按稳定食物ID归一别名，只计明确达到5克且排除油和待确认项", () => {
    const apple: FoodReference = {
      id: "test-apple",
      name: "苹果",
      aliases: ["红富士"],
      category: "FR",
      compatibleStates: ["EA"],
      basisUnit: "g",
      nutrientsPer100: { kcal: 50, protein: 0, fat: 0, carb: 13, fiber: 2 },
      source: { kind: "USER", ref: "test", release: "2026-08-25" }
    };
    const tinyFood: FoodReference = { ...vegetable, id: "tiny", name: "小白菜" };
    const exactFood: FoodReference = { ...vegetable, id: "exact", name: "胡萝卜" };
    const input = meal([
      { tempId: "apple-1", name: "苹果", category: "FR", state: "EA", quantityMin: 5, quantityMax: 5, unit: "g" },
      { tempId: "apple-2", name: "红富士", category: "FR", state: "EA", quantityMin: 10, quantityMax: 10, unit: "g" },
      { tempId: "tiny", name: "小白菜", category: "LV", state: "RW", quantityMin: 4.99, quantityMax: 4.99, unit: "g" },
      { tempId: "exact", name: "胡萝卜", category: "LV", state: "RW", quantityMin: 5, quantityMax: 5, unit: "g" },
      { tempId: "oil", name: "烹调油", category: "OI", state: "EA", quantityMin: 10, quantityMax: 10, unit: "g" },
      { tempId: "salt", name: "盐", category: "OT", state: "EA", quantityMin: 10, quantityMax: 10, unit: "g" }
    ]);
    const result = assess(input, [apple, tinyFood, exactFood]);

    expect(result.foodVarietyCount).toBe(2);
    expect(result.diversityEstimated).toBe(false);
  });

  it("重量区间跨过5克时不计入确定种类并标记估算", () => {
    const input = meal([{
      tempId: "range",
      name: "测试青菜",
      category: "LV",
      state: "RW",
      quantityMin: 4,
      quantityMax: 6,
      unit: "g"
    }]);
    const result = assess(input, [vegetable]);

    expect(result.foodVarietyCount).toBe(0);
    expect(result.diversityEstimated).toBe(true);
  });
});
