import type { FoodCategory, FoodState, QuantityUnit } from "../meals/types";

export interface NutrientVector {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
}

export interface NutrientRange {
  min: NutrientVector;
  max: NutrientVector;
}

export interface FoodReference {
  id: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  compatibleStates: FoodState[];
  basisUnit: Extract<QuantityUnit, "g" | "ml">;
  nutrientsPer100?: NutrientVector;
  gramsPerPiece?: number;
  source: {
    kind: "USDA_FDC" | "BOOK" | "USER";
    ref: string;
    release: string;
  };
  bookNote?: string;
}

export interface ItemNutritionFact {
  tempId: string;
  foodId: string;
  name: string;
  category: FoodCategory;
  basisUnit: "g" | "ml";
  basisQuantityMin: number;
  basisQuantityMax: number;
  nutrients: NutrientRange;
  sourceRef: string;
}

export interface UnknownNutritionItem {
  tempId: string;
  name: string;
  reason: string;
}

export interface NutritionFacts {
  mealId: string;
  totals: NutrientRange;
  items: ItemNutritionFact[];
  unknownItems: UnknownNutritionItem[];
  sourceRefs: string[];
  complete: boolean;
  knownItemCount: number;
  totalItemCount: number;
}

