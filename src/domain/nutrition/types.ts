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

export const BEVERAGE_SUGAR_PROFILES = [
  "UNSWEETENED",
  "ZERO_SUGAR_SWEETENED",
  "NO_ADDED_SUGAR",
  "SUGAR_SWEETENED",
  "UNKNOWN"
] as const;
export type BeverageSugarProfile = (typeof BEVERAGE_SUGAR_PROFILES)[number];

export const BEVERAGE_SUGAR_PROFILE_LABELS: Record<BeverageSugarProfile, string> = {
  UNSWEETENED: "无糖原味",
  ZERO_SUGAR_SWEETENED: "零糖/代糖",
  NO_ADDED_SUGAR: "无添加糖（含天然糖）",
  SUGAR_SWEETENED: "含添加糖",
  UNKNOWN: "糖状态未知"
};

export interface RecipeIngredientEstimate {
  name: string;
  weightG: number;
}

export const NUTRIENT_KEYS = ["kcal", "protein", "fat", "carb", "fiber"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type PartialNutrientVector = Partial<NutrientVector>;

export interface NutrientCoverageEntry {
  knownItemCount: number;
  totalItemCount: number;
  complete: boolean;
}

export type NutrientCoverage = Record<NutrientKey, NutrientCoverageEntry>;

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
  /** 官方来源缺少个别字段时保留已知项；缺失字段不得按 0 处理。 */
  partialNutrientsPer100?: PartialNutrientVector;
  gramsPerPiece?: number;
  /** 旧数据未设置时按常见单品处理。 */
  foodKind?: FoodKind;
  tags?: string[];
  /** 仅用于饮品；与奶、豆、酒等主分类相互独立。 */
  beverageSugarProfile?: BeverageSugarProfile;
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
  /** 旧快照未设置时表示五项营养值均已知。 */
  knownNutrients?: NutrientKey[];
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
  /** 旧快照未设置时按 complete 对五项营养作保守推断。 */
  nutrientCoverage?: NutrientCoverage;
}

