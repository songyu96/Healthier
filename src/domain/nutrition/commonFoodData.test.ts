import { describe, expect, it } from "vitest";
import { COMMON_FOODS } from "./commonFoodData";
import { BASE_FOODS } from "./foodData";

describe("common food data", () => {
  it("覆盖水果、家常餐、外卖、零食和聚会酒水", () => {
    expect(COMMON_FOODS).toHaveLength(88);
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
      "instant-noodles-unknown",
      "hotpot-unknown"
    ]));
  });

  it("西瓜和原有的梨均可在内置库中找到", () => {
    expect(COMMON_FOODS.some((food) => food.name === "西瓜")).toBe(true);
    expect(BASE_FOODS.some((food) => food.name === "梨")).toBe(true);
  });

  it("66项可计算数据保留最新版FDC来源和完整五项营养值", () => {
    const known = COMMON_FOODS.filter((food) => food.nutrientsPer100);
    expect(known).toHaveLength(66);
    expect(new Set(known.map((food) => food.source.ref)).size).toBe(66);

    known.forEach((food) => {
      expect(food.source).toMatchObject({
        kind: "USDA_FDC",
        release: "USDA FNDDS 2021–2023 (2024-10-31)",
        method: "OFFICIAL_COMPOSITION"
      });
      expect(food.source.ref).toMatch(/^FDC:\d+$/);
      expect(food.nutrientsPer100).toEqual({
        kcal: expect.any(Number),
        protein: expect.any(Number),
        fat: expect.any(Number),
        carb: expect.any(Number),
        fiber: expect.any(Number)
      });
    });
  });

  it("模糊名称只记录事实，不伪造营养值", () => {
    const unknown = COMMON_FOODS.filter((food) => !food.nutrientsPer100);
    expect(unknown).toHaveLength(22);
    unknown.forEach((food) => {
      expect(food.source.kind).toBe("REFERENCE");
      expect(food.dataCaveats?.length).toBeGreaterThan(0);
    });
    expect(COMMON_FOODS.find((food) => food.aliases.includes("白酒"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("包子"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("豆浆"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("火锅"))?.nutrientsPer100).toBeUndefined();
    expect(COMMON_FOODS.find((food) => food.aliases.includes("方便面"))?.nutrientsPer100).toBeUndefined();
  });
});
