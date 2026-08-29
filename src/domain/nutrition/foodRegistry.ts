import type { FoodReference } from "./types";
import { CHINA_FOODS } from "./chinaFoodData";
import { COMMON_FOODS } from "./commonFoodData";
import { FNDDS_FOODS } from "./curatedFoodData";
import { BASE_FOODS, mergeFoodReferences } from "./foodData";

export const BUILT_IN_FOODS: FoodReference[] = [
  ...BASE_FOODS,
  ...FNDDS_FOODS,
  ...CHINA_FOODS,
  ...COMMON_FOODS
];

export function mergeFoodRegistry(overrides: FoodReference[]): FoodReference[] {
  return mergeFoodReferences(BUILT_IN_FOODS, overrides);
}
