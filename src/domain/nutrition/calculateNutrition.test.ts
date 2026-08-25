import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "../meals/types";
import type { FoodReference } from "./types";
import { calculateNutrition } from "./calculateNutrition";
import { BASE_FOODS } from "./foodData";

function meal(overrides: Partial<ConfirmedMeal> = {}): ConfirmedMeal {
  return {
    id: "meal-1",
    protocolVersion: "HD1",
    eatenAt: "2026-08-24T12:30:00",
    date: "2026-08-24",
    mealType: "L",
    items: [
      {
        tempId: "rice",
        name: "米饭",
        category: "GR",
        state: "CK",
        quantityMin: 100,
        quantityMax: 200,
        unit: "g"
      }
    ],
    cookingMethod: "BOIL",
    note: "",
    rawImportLine: "HD1|20260824-1230|L|米饭~GR~CK~100-200g|BOIL|无",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "book-rules-0.1",
    createdAt: "2026-08-24T12:31:00",
    updatedAt: "2026-08-24T12:31:00",
    ...overrides
  };
}

describe("calculateNutrition", () => {
  it("按USDA每100克数据保留摄入区间", () => {
    const result = calculateNutrition(meal(), BASE_FOODS);
    expect(result.unknownItems).toHaveLength(0);
    expect(result.totals.min.kcal).toBeCloseTo(130, 1);
    expect(result.totals.max.kcal).toBeCloseTo(260, 1);
    expect(result.sourceRefs[0]).toContain("SR28:20045");
    expect(result.complete).toBe(true);
  });

  it("不把熟重直接套用到只支持生重的食物", () => {
    const input = meal();
    input.items[0] = {
      ...input.items[0],
      name: "苹果",
      category: "FR",
      state: "CK"
    };
    const result = calculateNutrition(input, BASE_FOODS);
    expect(result.items).toHaveLength(0);
    expect(result.unknownItems[0].reason).toContain("状态");
  });

  it("没有匹配数据时不产生伪营养值", () => {
    const input = meal();
    input.items[0] = { ...input.items[0], name: "自制神秘菜", category: "OT" };
    const result = calculateNutrition(input, BASE_FOODS);
    expect(result.totals.min.kcal).toBe(0);
    expect(result.unknownItems).toHaveLength(1);
    expect(result.complete).toBe(false);
  });

  it("仅食物组条目不会被当成确定的零营养食物", () => {
    const input = meal();
    input.items[0] = { ...input.items[0], canonicalFoodId: "group-only" };
    const groupOnly: FoodReference = {
      id: "group-only",
      name: "自制主食",
      aliases: [],
      category: "GR",
      compatibleStates: ["CK"],
      basisUnit: "g",
      source: { kind: "USER", ref: "用户录入", release: "2026-08-25" }
    };
    const result = calculateNutrition(input, [groupOnly]);
    expect(result.items).toHaveLength(0);
    expect(result.complete).toBe(false);
    expect(result.unknownItems[0].reason).toContain("未提供营养值");
  });
});

