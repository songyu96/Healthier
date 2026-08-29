import { describe, expect, it } from "vitest";
import { nutrientsFromFormValues, nutrientsToFormValues } from "./foodOverrides";
import type { FoodReference } from "./types";

const partialFish: FoodReference = {
  id: "partial-fish",
  name: "鲫鱼",
  aliases: [],
  category: "FI",
  compatibleStates: ["RW"],
  basisUnit: "g",
  partialNutrientsPer100: { kcal: 109, protein: 17.1, fat: 2.7, carb: 3.8 },
  source: { kind: "REFERENCE", ref: "test", release: "test" }
};

describe("food override nutrients", () => {
  it("编辑部分营养食物时保留已知值并让缺失字段为空", () => {
    expect(nutrientsToFormValues(partialFish)).toEqual({
      kcal: 109,
      protein: 17.1,
      fat: 2.7,
      carb: 3.8,
      fiber: ""
    });
  });

  it("部分输入保存为partial且不会把空字段变成零", () => {
    expect(nutrientsFromFormValues(nutrientsToFormValues(partialFish))).toEqual({
      partialNutrientsPer100: { kcal: 109, protein: 17.1, fat: 2.7, carb: 3.8 }
    });
  });

  it("五项齐全和全空分别保存为完整营养及仅记录", () => {
    expect(nutrientsFromFormValues({ kcal: 100, protein: 2, fat: 1, carb: 20, fiber: 3 }))
      .toEqual({ nutrientsPer100: { kcal: 100, protein: 2, fat: 1, carb: 20, fiber: 3 } });
    expect(nutrientsFromFormValues({ kcal: "", protein: "", fat: "", carb: "", fiber: "" }))
      .toEqual({});
  });
});
