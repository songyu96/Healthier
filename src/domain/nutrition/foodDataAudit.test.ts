import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "../meals/types";
import { calculateNutrition } from "./calculateNutrition";
import { BASE_FOODS } from "./foodData";

describe("food data source compatibility audit", () => {
  it("具体肉类条目不使用宽泛肉类别名", () => {
    const chicken = BASE_FOODS.find((food) => food.id === "chicken-breast-roasted")!;
    expect(chicken.aliases).not.toContain("鸡肉");
    const beef = BASE_FOODS.find((food) => food.id === "beef-round-roasted")!;
    expect(beef.aliases).not.toContain("牛肉");
    expect(beef.aliases).toContain("烤瘦牛肉");

    const meal: ConfirmedMeal = {
      id: "generic-chicken",
      protocolVersion: "HD1",
      eatenAt: "2026-08-25T12:00:00",
      date: "2026-08-25",
      mealType: "L",
      cookingMethod: "UNKNOWN",
      note: "",
      rawImportLine: "test",
      unknownOil: false,
      unknownSalt: false,
      ruleSetVersion: "book-rules-0.1",
      createdAt: "2026-08-25T12:01:00",
      updatedAt: "2026-08-25T12:01:00",
      items: [{ tempId: "chicken", name: "鸡肉", category: "MP", state: "CK", quantityMin: 100, quantityMax: 100, unit: "g" }]
    };
    expect(calculateNutrition(meal, BASE_FOODS).unknownItems).toHaveLength(1);
  });

  it("北豆腐和生花生只声明源数据对应状态", () => {
    expect(BASE_FOODS.find((food) => food.id === "tofu-firm")?.compatibleStates).toEqual(["RW"]);
    expect(BASE_FOODS.find((food) => food.id === "peanuts-raw")?.compatibleStates).toEqual(["RW"]);
  });

  it("牛奶保留克毫升近似来源说明", () => {
    const milk = BASE_FOODS.find((food) => food.id === "milk-whole")!;
    expect(milk.dataCaveats?.join("")).toContain("1克≈1毫升");
    expect(milk.bookNote).toBeUndefined();
  });
});
