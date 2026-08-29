import { NUTRIENT_KEYS } from "./types";
import type { FoodReference, NutrientKey, NutrientVector, PartialNutrientVector } from "./types";

export type NutrientFormValue = number | "";
export type NutrientFormValues = Record<NutrientKey, NutrientFormValue>;

export function nutrientsToFormValues(food: FoodReference): NutrientFormValues {
  const nutrients = food.nutrientsPer100 ?? food.partialNutrientsPer100;
  return {
    kcal: nutrients?.kcal ?? "",
    protein: nutrients?.protein ?? "",
    fat: nutrients?.fat ?? "",
    carb: nutrients?.carb ?? "",
    fiber: nutrients?.fiber ?? ""
  };
}

export function nutrientsFromFormValues(values: NutrientFormValues): Pick<
  FoodReference,
  "nutrientsPer100" | "partialNutrientsPer100"
> {
  const knownEntries = NUTRIENT_KEYS
    .filter((key) => values[key] !== "")
    .map((key) => {
      const value = values[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error("营养值必须是非负有限数值。");
      }
      return [key, value] as const;
    });

  if (knownEntries.length === 0) return {};
  const nutrients = Object.fromEntries(knownEntries) as PartialNutrientVector;
  return knownEntries.length === NUTRIENT_KEYS.length
    ? { nutrientsPer100: nutrients as NutrientVector }
    : { partialNutrientsPer100: nutrients };
}
