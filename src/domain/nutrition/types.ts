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

export const FOOD_KINDS = ["INGREDIENT", "COMPOSITE", "PACKAGED"] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

export const FOOD_SOURCE_METHODS = ["OFFICIAL_COMPOSITION", "LABEL", "RECIPE", "USER"] as const;
export type FoodSourceMethod = (typeof FOOD_SOURCE_METHODS)[number];

export const NUTRITION_RELIABILITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type NutritionReliability = (typeof NUTRITION_RELIABILITIES)[number];

export interface RecipeIngredientEstimate {
  name: string;
  weightG: number;
}

export interface RecipeEstimate {
  finalWeightG: number;
  ingredients: RecipeIngredientEstimate[];
  confidence: "MEDIUM" | "LOW";
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
  /** 旧数据未设置时按常见单品处理。 */
  foodKind?: FoodKind;
  tags?: string[];
  /** 只描述真实的数据限制或换算假设，不承载书本饮食规则。 */
  dataCaveats?: string[];
  /** 通用配方的透明估值依据；营养值仍统一折算到每100克成品。 */
  recipeEstimate?: RecipeEstimate;
  source: {
    kind: "USDA_FDC" | "BOOK" | "REFERENCE" | "USER";
    ref: string;
    release: string;
    method?: FoodSourceMethod;
  };
  /** @deprecated 仅为兼容旧备份；新数据请使用 dataCaveats。 */
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
  calculationBasis?: FoodSourceMethod;
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
  /** 旧快照可能缺少此字段，读取时按明细保守推断。 */
  reliability?: NutritionReliability;
  knownItemCount: number;
  totalItemCount: number;
}

