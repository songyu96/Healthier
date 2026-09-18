import { describe, expect, it } from "vitest";
import { calculateNutrition } from "./calculateNutrition";
import {
  nutrientsFromFormValues,
  nutrientsToFormValues,
  resolveFoodProvenanceForSave
} from "./foodOverrides";
import { BUILT_IN_FOODS } from "./foodRegistry";
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

  const youtiao = BUILT_IN_FOODS.find((food) => food.id === "youtiao-generic-recipe");

  it("油条只改元数据时保留配方来源和低可信度", () => {
    expect(youtiao).toBeDefined();
    const nutrition = nutrientsFromFormValues(nutrientsToFormValues(youtiao!));
    const provenance = resolveFoodProvenanceForSave({
      currentFood: youtiao,
      builtInFood: youtiao,
      nutrition,
      foodKind: youtiao!.foodKind ?? "COMPOSITE",
      release: "2026-09-10"
    });
    const edited: FoodReference = {
      ...youtiao!,
      name: "我常买的油条",
      ...nutrition,
      ...provenance
    };
    const facts = calculateNutrition({
      id: "meal-with-recipe",
      items: [{
        tempId: "recipe-item",
        name: edited.name,
        category: edited.category,
        state: "EA",
        quantityMin: 100,
        quantityMax: 100,
        unit: "g",
        canonicalFoodId: youtiao!.id
      }]
    }, [edited]);

    expect(edited.source).toEqual(youtiao!.source);
    expect(edited.recipeEstimate).toEqual(youtiao!.recipeEstimate);
    expect(facts.reliability).toBe("LOW");
  });

  it("油条修改热量后切换为用户来源并移除旧配方", () => {
    expect(youtiao).toBeDefined();
    const values = nutrientsToFormValues(youtiao!);
    if (typeof values.kcal !== "number") throw new Error("油条应有热量数据");
    const nutrition = nutrientsFromFormValues({ ...values, kcal: values.kcal + 1 });

    expect(resolveFoodProvenanceForSave({
      currentFood: youtiao,
      builtInFood: youtiao,
      nutrition,
      foodKind: youtiao!.foodKind ?? "COMPOSITE",
      release: "2026-09-10"
    })).toEqual({
      source: { kind: "USER", ref: "用户录入", release: "2026-09-10", method: "USER" }
    });
  });

  it("旧错误覆盖与内置营养一致时恢复内置来源和低可信度", () => {
    expect(youtiao).toBeDefined();
    const brokenOverride: FoodReference = {
      ...youtiao!,
      source: { kind: "USER", ref: "用户录入", release: "2026-08-01", method: "USER" },
      recipeEstimate: undefined
    };
    const nutrition = nutrientsFromFormValues(nutrientsToFormValues(brokenOverride));

    const provenance = resolveFoodProvenanceForSave({
      currentFood: brokenOverride,
      builtInFood: youtiao,
      nutrition,
      foodKind: brokenOverride.foodKind ?? "COMPOSITE",
      release: "2026-09-10"
    });

    expect(provenance.source).toEqual(youtiao!.source);
    expect(provenance.recipeEstimate).toEqual(youtiao!.recipeEstimate);
    expect(provenance.recipeEstimate?.confidence).toBe("LOW");
  });

  it("营养空白与零不会被视为相同", () => {
    const noNutrition: FoodReference = {
      ...partialFish,
      partialNutrientsPer100: undefined,
      source: { kind: "REFERENCE", ref: "unknown", release: "v1", method: "RECIPE" }
    };
    const zeroNutrition = nutrientsFromFormValues({ kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 });

    expect(resolveFoodProvenanceForSave({
      currentFood: noNutrition,
      nutrition: zeroNutrition,
      foodKind: "INGREDIENT",
      release: "2026-09-10"
    })).toEqual({
      source: { kind: "USER", ref: "用户录入", release: "2026-09-10", method: "USER" }
    });
  });

  it("新增包装食物继续使用标签来源", () => {
    expect(resolveFoodProvenanceForSave({
      nutrition: nutrientsFromFormValues({ kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 }),
      foodKind: "PACKAGED",
      release: "2026-09-10"
    })).toEqual({
      source: { kind: "USER", ref: "用户录入", release: "2026-09-10", method: "LABEL" }
    });
  });
});
