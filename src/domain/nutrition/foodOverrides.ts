import { NUTRIENT_KEYS } from "./types";
import type { FoodKind, FoodReference, NutrientKey, NutrientVector, PartialNutrientVector } from "./types";

export type NutrientFormValue = number | "";
export type NutrientFormValues = Record<NutrientKey, NutrientFormValue>;
export type FoodProvenance = Pick<FoodReference, "source" | "recipeEstimate">;
export type FoodNutrition = Pick<FoodReference, "nutrientsPer100" | "partialNutrientsPer100">;

export function preserveFoodProvenance(food: FoodReference): FoodProvenance {
  return {
    source: food.source,
    ...(food.recipeEstimate ? { recipeEstimate: food.recipeEstimate } : {})
  };
}

function sameFoodNutrition(left: FoodNutrition, right: FoodNutrition): boolean {
  const leftNutrients = left.nutrientsPer100 ?? left.partialNutrientsPer100;
  const rightNutrients = right.nutrientsPer100 ?? right.partialNutrientsPer100;
  return NUTRIENT_KEYS.every((key) => leftNutrients?.[key] === rightNutrients?.[key]);
}

export function resolveFoodProvenanceForSave({
  currentFood,
  builtInFood,
  nutrition,
  foodKind,
  release
}: {
  currentFood?: FoodReference;
  builtInFood?: FoodReference;
  nutrition: FoodNutrition;
  foodKind: FoodKind;
  release: string;
}): FoodProvenance {
  if (builtInFood && sameFoodNutrition(nutrition, builtInFood)) {
    return preserveFoodProvenance(builtInFood);
  }
  if (currentFood && sameFoodNutrition(nutrition, currentFood)) {
    return preserveFoodProvenance(currentFood);
  }
  return {
    source: {
      kind: "USER",
      ref: "用户录入",
      release,
      method: foodKind === "PACKAGED" ? "LABEL" : "USER"
    }
  };
}

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
