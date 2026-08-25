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
});
