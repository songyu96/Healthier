import type { FoodReference } from "../nutrition/types";
import type { ConfirmedMeal, MealItemInput, MealType, ParsedMeal } from "./types";

export function createQuickMealItem(
  food: FoodReference,
  createTempId: () => string = () => crypto.randomUUID()
): MealItemInput {
  const unit = food.gramsPerPiece ? "pc" : food.basisUnit;
  const quantity = unit === "pc" ? 1 : unit === "ml" ? 250 : 100;
  return {
    tempId: createTempId(),
    name: food.name,
    category: food.category,
    state: food.compatibleStates[0] ?? "UN",
    quantityMin: quantity,
    quantityMax: quantity,
    unit,
    canonicalFoodId: food.id
  };
}

export function createQuickMealDraft(
  food: FoodReference,
  eatenAt: string,
  mealType: MealType,
  unknownOil: boolean,
  unknownSalt: boolean,
  createTempId?: () => string
): ParsedMeal {
  return {
    protocolVersion: "HD1",
    eatenAt,
    date: eatenAt.slice(0, 10),
    mealType,
    items: [createQuickMealItem(food, createTempId)],
    cookingMethod: "未填写",
    note: "快速记录",
    rawImportLine: "MANUAL_QUICK",
    unknownOil,
    unknownSalt
  };
}

export function appendQuickMealFood(
  draft: ParsedMeal | ConfirmedMeal,
  food: FoodReference,
  createTempId?: () => string
): ParsedMeal | ConfirmedMeal {
  return {
    ...draft,
    items: [...draft.items, createQuickMealItem(food, createTempId)]
  };
}

export function recentFoodIds(meals: ConfirmedMeal[], limit = 8): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  [...meals]
    .sort((left, right) => right.eatenAt.localeCompare(left.eatenAt))
    .forEach((meal) => {
      [...meal.items].reverse().forEach((item) => {
        if (!item.canonicalFoodId || seen.has(item.canonicalFoodId) || ids.length >= limit) return;
        seen.add(item.canonicalFoodId);
        ids.push(item.canonicalFoodId);
      });
    });
  return ids;
}
