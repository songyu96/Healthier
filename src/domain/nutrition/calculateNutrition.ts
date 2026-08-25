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

export function isNutritionFacts(value: unknown): value is NutritionFacts {
  if (!value || typeof value !== "object") return false;
  const facts = value as Partial<NutritionFacts>;
  return typeof facts.mealId === "string" &&
    typeof facts.complete === "boolean" &&
    Number.isInteger(facts.knownItemCount) &&
    Number.isInteger(facts.totalItemCount) &&
    Array.isArray(facts.items) && Array.isArray(facts.unknownItems) &&
    Array.isArray(facts.sourceRefs) && Boolean(facts.totals);
}

export function nutritionFactsForMeal(meal: ConfirmedMeal, foods: FoodReference[]): NutritionFacts {
  return isNutritionFacts(meal.nutritionSnapshot) && meal.nutritionSnapshot.mealId === meal.id
    ? meal.nutritionSnapshot
    : calculateNutrition(meal, foods);
}
