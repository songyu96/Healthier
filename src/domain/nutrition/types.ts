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

export interface FoodReference {
  id: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  compatibleStates: FoodState[];
  basisUnit: Extract<QuantityUnit, "g" | "ml">;
  nutrientsPer100?: NutrientVector;
  gramsPerPiece?: number;
  /** 旧数据未设置时按基础食材处理。 */
  foodKind?: FoodKind;
  tags?: string[];
  /** 只描述真实的数据限制或换算假设，不承载书本饮食规则。 */
  dataCaveats?: string[];
  source: {
    kind: "USDA_FDC" | "BOOK" | "USER";
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

