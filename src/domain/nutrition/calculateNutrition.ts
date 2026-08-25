import type { ConfirmedMeal, MealItemInput } from "../meals/types";
import type {
  FoodReference,
  ItemNutritionFact,
  NutrientRange,
  NutrientVector,
  NutritionFacts
} from "./types";

const ZERO_VECTOR: NutrientVector = { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 };

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/[\s（）()]/g, "");
}

function scaleVector(vector: NutrientVector, quantity: number): NutrientVector {
  const factor = quantity / 100;
  return {
    kcal: vector.kcal * factor,
    protein: vector.protein * factor,
    fat: vector.fat * factor,
    carb: vector.carb * factor,
    fiber: vector.fiber * factor
  };
}

function addVector(left: NutrientVector, right: NutrientVector): NutrientVector {
  return {
    kcal: left.kcal + right.kcal,
    protein: left.protein + right.protein,
    fat: left.fat + right.fat,
    carb: left.carb + right.carb,
    fiber: left.fiber + right.fiber
  };
}

function findFood(item: MealItemInput, foods: FoodReference[]): FoodReference | undefined {
  if (item.canonicalFoodId) {
    const byId = foods.find((food) => food.id === item.canonicalFoodId);
    if (byId) return byId;
  }

  const itemName = normalizeName(item.name);
  return foods.find((food) =>
    food.category === item.category &&
    [food.name, ...food.aliases].some((name) => normalizeName(name) === itemName)
  );
}

function resolveBasisQuantity(
  item: MealItemInput,
  food: FoodReference
): { min: number; max: number } | null {
  if (item.unit === food.basisUnit) {
    return { min: item.quantityMin, max: item.quantityMax };
  }

  if (item.unit === "pc" && food.basisUnit === "g" && food.gramsPerPiece) {
    return {
      min: item.quantityMin * food.gramsPerPiece,
      max: item.quantityMax * food.gramsPerPiece
    };
  }

  return null;
}

export function calculateNutrition(
  meal: Pick<ConfirmedMeal, "id" | "items">,
  foods: FoodReference[]
): NutritionFacts {
  const facts: ItemNutritionFact[] = [];
  const unknownItems: NutritionFacts["unknownItems"] = [];

  meal.items.forEach((item) => {
    const food = findFood(item, foods);
    if (!food) {
      unknownItems.push({ tempId: item.tempId, name: item.name, reason: "食物库中没有匹配项" });
      return;
    }

    if (!food.nutrientsPer100) {
      unknownItems.push({ tempId: item.tempId, name: item.name, reason: "食物仅配置为食物组记录，未提供营养值" });
      return;
    }

    if (!food.compatibleStates.includes(item.state)) {
      unknownItems.push({
        tempId: item.tempId,
        name: item.name,
        reason: `记录状态${item.state}与食物库状态不一致`
      });
      return;
    }

    const quantity = resolveBasisQuantity(item, food);
    if (!quantity) {
      unknownItems.push({ tempId: item.tempId, name: item.name, reason: "单位无法可靠换算" });
      return;
    }

    facts.push({
      tempId: item.tempId,
      foodId: food.id,
      name: item.name,
      category: item.category,
      basisUnit: food.basisUnit,
      basisQuantityMin: quantity.min,
      basisQuantityMax: quantity.max,
      nutrients: {
        min: scaleVector(food.nutrientsPer100, quantity.min),
        max: scaleVector(food.nutrientsPer100, quantity.max)
      },
      sourceRef: `${food.source.kind}:${food.source.ref}:${food.source.release}`
    });
  });

  const totals = facts.reduce<NutrientRange>(
    (sum, fact) => ({
      min: addVector(sum.min, fact.nutrients.min),
      max: addVector(sum.max, fact.nutrients.max)
    }),
    { min: { ...ZERO_VECTOR }, max: { ...ZERO_VECTOR } }
  );

  return {
    mealId: meal.id,
    totals,
    items: facts,
    unknownItems,
    sourceRefs: [...new Set(facts.map((fact) => fact.sourceRef))],
    complete: unknownItems.length === 0,
    knownItemCount: facts.length,
    totalItemCount: meal.items.length
  };
}

const NUTRIENT_KEYS = ["kcal", "protein", "fat", "carb", "fiber"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNutrientVector(value: unknown): value is NutrientVector {
  return isRecord(value) && NUTRIENT_KEYS.every((key) => isFiniteNonNegative(value[key]));
}

function isNutrientRange(value: unknown): value is NutrientRange {
  if (!isRecord(value)) return false;
  const { min, max } = value;
  if (!isNutrientVector(min) || !isNutrientVector(max)) return false;
  return NUTRIENT_KEYS.every((key) => min[key] <= max[key]);
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));
}

function sameNutrientRange(left: NutrientRange, right: NutrientRange): boolean {
  return NUTRIENT_KEYS.every((key) =>
    approximatelyEqual(left.min[key], right.min[key]) &&
    approximatelyEqual(left.max[key], right.max[key])
  );
}

export function isNutritionFacts(value: unknown): value is NutritionFacts {
  if (!isRecord(value) || !isNonEmptyString(value.mealId) ||
      typeof value.complete !== "boolean" || !Number.isInteger(value.knownItemCount) ||
      !Number.isInteger(value.totalItemCount) || !Array.isArray(value.items) ||
      !Array.isArray(value.unknownItems) || !Array.isArray(value.sourceRefs) ||
      !isNutrientRange(value.totals)) return false;

  const itemsValid = value.items.every((item) => isRecord(item) &&
    isNonEmptyString(item.tempId) && isNonEmptyString(item.foodId) &&
    isNonEmptyString(item.name) && isNonEmptyString(item.category) &&
    (item.basisUnit === "g" || item.basisUnit === "ml") &&
    isFiniteNonNegative(item.basisQuantityMin) &&
    isFiniteNonNegative(item.basisQuantityMax) &&
    item.basisQuantityMin <= item.basisQuantityMax &&
    isNutrientRange(item.nutrients) && isNonEmptyString(item.sourceRef));
  const unknownItemsValid = value.unknownItems.every((item) => isRecord(item) &&
    isNonEmptyString(item.tempId) && isNonEmptyString(item.name) && isNonEmptyString(item.reason));
  if (!itemsValid || !unknownItemsValid ||
      !value.sourceRefs.every(isNonEmptyString)) return false;

  const items = value.items as ItemNutritionFact[];
  const unknownItems = value.unknownItems as NutritionFacts["unknownItems"];
  const sourceRefs = value.sourceRefs as string[];
  const tempIds = [...items.map((item) => item.tempId), ...unknownItems.map((item) => item.tempId)];
  if (new Set(tempIds).size !== tempIds.length ||
      value.knownItemCount !== items.length ||
      value.totalItemCount !== tempIds.length ||
      value.complete !== (unknownItems.length === 0)) return false;

  const expectedTotals = items.reduce<NutrientRange>(
    (sum, item) => ({
      min: addVector(sum.min, item.nutrients.min),
      max: addVector(sum.max, item.nutrients.max)
    }),
    { min: { ...ZERO_VECTOR }, max: { ...ZERO_VECTOR } }
  );
  if (!sameNutrientRange(value.totals, expectedTotals)) return false;

  const expectedSourceRefs = new Set(items.map((item) => item.sourceRef));
  return new Set(sourceRefs).size === sourceRefs.length &&
    sourceRefs.length === expectedSourceRefs.size &&
    sourceRefs.every((sourceRef) => expectedSourceRefs.has(sourceRef));
}

export function nutritionFactsForMeal(meal: ConfirmedMeal, foods: FoodReference[]): NutritionFacts {
  return isNutritionFacts(meal.nutritionSnapshot) && meal.nutritionSnapshot.mealId === meal.id
    ? meal.nutritionSnapshot
    : calculateNutrition(meal, foods);
}
