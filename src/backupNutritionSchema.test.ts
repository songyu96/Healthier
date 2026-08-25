import { describe, expect, it } from "vitest";
import { nutritionFactsSchema } from "./backupNutritionSchema";

const emptyFacts = {
  mealId: "meal-1",
  totals: {
    min: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 },
    max: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 }
  },
  items: [],
  unknownItems: [],
  sourceRefs: [],
  complete: true,
  knownItemCount: 0,
  totalItemCount: 0
};

describe("nutrition snapshot backup schema", () => {
  it("接受内部一致的空营养快照", () => {
    expect(nutritionFactsSchema.parse(emptyFacts)).toEqual(emptyFacts);
  });

  it("拒绝计数或完整状态不一致", () => {
    expect(() => nutritionFactsSchema.parse({ ...emptyFacts, knownItemCount: 1 })).toThrow();
    expect(() => nutritionFactsSchema.parse({ ...emptyFacts, complete: false })).toThrow();
  });

  it("拒绝总计、重复tempId和来源集合不一致", () => {
    const item = {
      tempId: "rice",
      foodId: "rice-cooked",
      name: "米饭",
      category: "GR" as const,
      basisUnit: "g" as const,
      basisQuantityMin: 100,
      basisQuantityMax: 100,
      nutrients: {
        min: { kcal: 130, protein: 2.7, fat: 0.3, carb: 28, fiber: 0.4 },
        max: { kcal: 130, protein: 2.7, fat: 0.3, carb: 28, fiber: 0.4 }
      },
      sourceRef: "USDA_FDC:SR28:20045"
    };
    const valid = {
      ...emptyFacts,
      totals: item.nutrients,
      items: [item],
      sourceRefs: [item.sourceRef],
      knownItemCount: 1,
      totalItemCount: 1
    };

    expect(nutritionFactsSchema.safeParse(valid).success).toBe(true);
    expect(nutritionFactsSchema.safeParse({
      ...valid,
      totals: { ...valid.totals, min: { ...valid.totals.min, kcal: 131 } }
    }).success).toBe(false);
    expect(nutritionFactsSchema.safeParse({
      ...valid, items: [item, item], knownItemCount: 2, totalItemCount: 2
    }).success).toBe(false);
    expect(nutritionFactsSchema.safeParse({
      ...valid, sourceRefs: ["USDA_FDC:tampered:2026"]
    }).success).toBe(false);
  });
});
