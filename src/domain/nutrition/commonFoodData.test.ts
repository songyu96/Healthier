import { describe, expect, it } from "vitest";
import { COMMON_FOODS } from "./commonFoodData";
import { BASE_FOODS } from "./foodData";

describe("common food data", () => {
  it("覆盖水果、家常餐、外卖、零食和聚会酒水", () => {
    expect(COMMON_FOODS).toHaveLength(95);
    expect(COMMON_FOODS.map((food) => food.id)).toEqual(expect.arrayContaining([
      "coffee-brewed-current",
      "coffee-unknown",
      "milk-tea-unknown",
      "bao-bun-meat-current",
      "bao-bun-unknown",
      "fried-rice-nfs-current",
      "french-fries-fast-food-current",
      "chocolate-cake-bakery-current",
      "beer-current",
      "wine-red-current",
      "baijiu-unknown",
      "watermelon-raw-current",
      "chinese-cabbage-raw-current",
      "congee-plain-current",
      "soy-milk-unknown",
      "chicken-thigh-roasted-current",
      "instant-noodles-prepared-generic",
      "mantou-generic-recipe",
      "mixed-meal-meat-estimate",
      "mixed-meal-fish-estimate",
      "mixed-meal-egg-estimate",
      "mixed-meal-tuber-estimate",
      "hotpot-unknown"
    ]));
  });

  it("西瓜和原有的梨均可在内置库中找到", () => {
    expect(COMMON_FOODS.some((food) => food.name === "西瓜")).toBe(true);
    expect(BASE_FOODS.some((food) => food.name === "梨")).toBe(true);
  });

  it("86项可计算数据均提供完整五项营养值", () => {
    const known = COMMON_FOODS.filter((food) => food.nutrientsPer100);
    expect(known).toHaveLength(86);
    expect(new Set(known.map((food) => food.source.ref)).size).toBe(86);

    known.forEach((food) => {
      expect(food.nutrientsPer100).toEqual({
        kcal: expect.any(Number),
        protein: expect.any(Number),
        fat: expect.any(Number),
        carb: expect.any(Number),
        fiber: expect.any(Number)
      });
    });

    const official = known.filter((food) => food.source.method === "OFFICIAL_COMPOSITION");
    expect(official).toHaveLength(72);
    official.forEach((food) => {
      expect(food.source.kind).toBe("USDA_FDC");
      expect(food.source.ref).toMatch(/^FDC:\d+$/);
    });

    const estimates = known.filter((food) => food.source.method === "RECIPE");
    expect(estimates).toHaveLength(14);
    estimates.forEach((food) => {
      expect(food.recipeEstimate?.finalWeightG).toBeGreaterThan(0);
      expect(food.recipeEstimate?.ingredients.length).toBeGreaterThan(0);
      expect(food.recipeEstimate?.ingredients.every((ingredient) => ingredient.weightG > 0)).toBe(true);
    });
  });

  it("模糊名称只记录事实，不伪造营养值", () => {
    const unknown = COMMON_FOODS.filter((food) => !food.nutrientsPer100);
    expect(unknown).toHaveLength(9);
    unknown.forEach((food) => {
      expect(food.source.kind).toBe("REFERENCE");
      expect(food.dataCaveats?.length).toBeGreaterThan(0);
    });
    expect(COMMON_FOODS.find((food) => food.aliases.includes("白酒"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("包子"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.id === "soy-milk-unknown")?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("火锅"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("方便面"))?.nutrientsPer100).toBeDefined();
  });

  it("食物类型按记录方式划分而不是按是否加工划分", () => {
    for (const id of ["congee-plain-current", "mantou-generic-recipe", "youtiao-generic-recipe", "soy-milk-unsweetened-current", "soy-milk-unknown"]) {
      expect(COMMON_FOODS.find((food) => food.id === id)?.foodKind, id).toBe("INGREDIENT");
    }
    expect(COMMON_FOODS.find((food) => food.id === "dumpling-boiled-generic-recipe")?.foodKind).toBe("COMPOSITE");
    expect(COMMON_FOODS.find((food) => food.id === "instant-noodles-prepared-generic")?.foodKind).toBe("PACKAGED");
  });
});
