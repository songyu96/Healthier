import { describe, expect, it } from "vitest";
import { FNDDS_FOODS } from "./curatedFoodData";
import { COMMON_FOODS } from "./commonFoodData";
import { BASE_FOODS } from "./foodData";

const ALL_FOODS = [...BASE_FOODS, ...FNDDS_FOODS, ...COMMON_FOODS];

function exactFood(input: string) {
  return ALL_FOODS.filter((food) => food.name === input || food.aliases.includes(input));
}

describe("beverage data", () => {
  it("非奶豆酒饮品统一使用饮料主分类并声明糖状态", () => {
    const beverages = ALL_FOODS.filter((food) => food.category === "SD");
    expect(beverages.length).toBeGreaterThanOrEqual(20);
    beverages.forEach((food) => {
      expect(food.basisUnit, food.id).toBe("ml");
      expect(food.beverageSugarProfile, food.id).toBeDefined();
    });

    expect(exactFood("可乐")[0]).toMatchObject({
      id: "soft-drink-cola",
      beverageSugarProfile: "SUGAR_SWEETENED"
    });
    expect(exactFood("零糖可乐")[0]).toMatchObject({
      id: "cola-diet-current",
      category: "SD",
      beverageSugarProfile: "ZERO_SUGAR_SWEETENED"
    });
  });

  it("奶、豆和酒精饮品仍保留书本主分类", () => {
    expect(exactFood("纯牛奶")[0]).toMatchObject({ category: "DA", beverageSugarProfile: "NO_ADDED_SUGAR" });
    expect(exactFood("无糖豆奶")[0]).toMatchObject({ category: "SO", beverageSugarProfile: "UNSWEETENED" });
    expect(exactFood("啤酒")[0]).toMatchObject({ category: "AL" });
  });

  it.each([
    ["乌龙茶", "tea-unsweetened-other-unknown"],
    ["冰红茶", "tea-bottled-sweetened-unknown"],
    ["无糖汽水", "soft-drink-zero-other-unknown"],
    ["苹果汁", "fruit-juice-unknown"],
    ["果味饮料", "fruit-drink-unknown"],
    ["番茄汁", "vegetable-juice-unknown"],
    ["电解质水", "sports-electrolyte-drink-unknown"],
    ["功能饮料", "energy-drink-unknown"],
    ["三合一咖啡", "coffee-sweetened-unknown"],
    ["燕麦奶", "plant-drink-unknown"],
    ["乳酸菌饮料", "yogurt-drink-unknown"],
    ["水果茶", "fruit-tea-unknown"]
  ])("常见输入 %s 精确命中保守条目", (input, expectedId) => {
    expect(exactFood(input).map((food) => food.id)).toEqual([expectedId]);
  });

  it("品牌或配方不明的新增饮品不伪造营养值", () => {
    const newUnknownIds = [
      "tea-unsweetened-other-unknown",
      "tea-bottled-sweetened-unknown",
      "soft-drink-sugared-other-unknown",
      "soft-drink-zero-other-unknown",
      "fruit-juice-unknown",
      "fruit-drink-unknown",
      "vegetable-juice-unknown",
      "sports-electrolyte-drink-unknown",
      "energy-drink-unknown",
      "coffee-sweetened-unknown",
      "plant-drink-unknown",
      "yogurt-drink-unknown",
      "fruit-tea-unknown"
    ];
    newUnknownIds.forEach((id) => {
      const food = COMMON_FOODS.find((item) => item.id === id);
      expect(food?.nutrientsPer100, id).toBeUndefined();
      expect(food?.dataCaveats?.length, id).toBeGreaterThan(0);
    });
  });
});
