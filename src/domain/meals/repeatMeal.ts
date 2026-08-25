import type { ConfirmedMeal, ParsedMeal } from "./types";

export function createRepeatMealDraft(
  meal: ConfirmedMeal,
  eatenAt: string,
  createTempId: () => string = () => crypto.randomUUID()
): ParsedMeal {
  return {
    protocolVersion: "HD1",
    eatenAt,
    date: eatenAt.slice(0, 10),
    mealType: meal.mealType,
    items: meal.items.map((item) => ({
      ...item,
      tempId: createTempId()
    })),
    cookingMethod: meal.cookingMethod,
    note: meal.note,
    rawImportLine: meal.rawImportLine,
    unknownOil: meal.unknownOil,
    unknownSalt: meal.unknownSalt
  };
}
