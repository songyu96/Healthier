import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "./types";
import type { FoodReference } from "../nutrition/types";
import {
  appendQuickMealFood,
  createQuickMealDraft,
  createQuickMealItem,
  recentFoodIds
} from "./quickMeal";

function food(overrides: Partial<FoodReference> = {}): FoodReference {
  return {
    id: "rice",
    name: "熟米饭",
    aliases: [],
    category: "GR",
    compatibleStates: ["CK"],
    basisUnit: "g",
    source: { kind: "USER", ref: "test", release: "test" },
    ...overrides
  };
}

function meal(id: string, eatenAt: string, foodIds: string[]): ConfirmedMeal {
  return {
    id,
    protocolVersion: "HD1",
    eatenAt,
    date: eatenAt.slice(0, 10),
    mealType: "L",
    items: foodIds.map((foodId, index) => ({
      tempId: `${id}-${index}`,
      name: foodId,
      category: "GR",
      state: "CK",
      quantityMin: 100,
      quantityMax: 100,
      unit: "g",
      canonicalFoodId: foodId
    })),
    cookingMethod: "",
    note: "",
    rawImportLine: "test",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "test",
    createdAt: eatenAt,
    updatedAt: eatenAt
  };
}

describe("quick meal", () => {
  it("为克、毫升和按个食物提供可编辑默认份量", () => {
    expect(createQuickMealItem(food(), () => "g")).toMatchObject({
      tempId: "g", state: "CK", quantityMin: 100, quantityMax: 100, unit: "g"
    });
    expect(createQuickMealItem(food({
      id: "milk", basisUnit: "ml", compatibleStates: ["EA"]
    }), () => "ml")).toMatchObject({
      tempId: "ml", state: "EA", quantityMin: 250, quantityMax: 250, unit: "ml"
    });
    expect(createQuickMealItem(food({
      id: "egg", gramsPerPiece: 50, compatibleStates: ["CK"]
    }), () => "pc")).toMatchObject({
      tempId: "pc", state: "CK", quantityMin: 1, quantityMax: 1, unit: "pc"
    });
  });

  it("创建草稿并向当前草稿追加食物", () => {
    const draft = createQuickMealDraft(
      food(),
      "2026-08-30T12:00:00",
      "L",
      true,
      true,
      () => "rice"
    );
    const appended = appendQuickMealFood(
      draft,
      food({ id: "milk", name: "牛奶", basisUnit: "ml", category: "DA" }),
      () => "milk"
    );

    expect(appended.items.map((item) => item.tempId)).toEqual(["rice", "milk"]);
    expect(appended.mealType).toBe("L");
    expect(appended.rawImportLine).toBe("MANUAL_QUICK");
  });

  it("最近食物按餐食时间倒序去重并限制数量", () => {
    const meals = [
      meal("old", "2026-08-29T08:00:00", ["rice", "egg"]),
      meal("new", "2026-08-30T12:00:00", ["rice", "fish", "milk"])
    ];

    expect(recentFoodIds(meals, 3)).toEqual(["milk", "fish", "rice"]);
  });
});
