import { describe, expect, it } from "vitest";
import type { ConfirmedMeal } from "../meals/types";
import { calculateNutrition } from "../nutrition/calculateNutrition";
import { BASE_FOODS } from "../nutrition/foodData";
import { assessDay } from "./assessDay";
import { calculateTargets } from "./targets";

describe("ingredient diversity normalization", () => {
  it("主要原料同为小麦的面包和面条只计一种", () => {
    const meal: ConfirmedMeal = {
      id: "wheat-products",
      protocolVersion: "HD1",
      eatenAt: "2026-08-25T12:00:00",
      date: "2026-08-25",
      mealType: "L",
      cookingMethod: "MIXED",
      note: "",
      rawImportLine: "test",
      unknownOil: false,
      unknownSalt: false,
      ruleSetVersion: "book-rules-0.1",
      createdAt: "2026-08-25T12:01:00",
      updatedAt: "2026-08-25T12:01:00",
      items: [
        { tempId: "bread", name: "全麦面包", category: "WG", state: "EA", quantityMin: 20, quantityMax: 20, unit: "g", canonicalFoodId: "bread-whole-wheat" },
        { tempId: "noodles", name: "面条", category: "GR", state: "CK", quantityMin: 100, quantityMax: 100, unit: "g", canonicalFoodId: "egg-noodles-cooked" }
      ]
    };
    const targets = calculateTargets({
      id: "default",
      heightCm: 175,
      currentWeightKg: 70,
      activityLevel: "LIGHT",
      overweightAdjustmentEnabled: false,
      healthFlags: [],
      updatedAt: "2026-08-25T00:00:00"
    });
    const result = assessDay(
      meal.date,
      [{ meal, facts: calculateNutrition(meal, BASE_FOODS) }],
      targets,
      { completed: true, waterMl: 0 }
    );

    expect(result.foodVarietyCount).toBe(1);
  });
});
