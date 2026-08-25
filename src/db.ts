import Dexie, { type EntityTable } from "dexie";
import type {
  ConfirmedMeal,
  FoodReference,
  MealItemInput,
  UserProfile
} from "./domain";

export interface BodyMetric {
  id: string;
  measuredAt: string;
  weightKg: number;
  waistCm?: number;
  note?: string;
}

export type StoredMeal = Omit<ConfirmedMeal, "items">;

export interface StoredMealItem extends MealItemInput {
  id: string;
  mealId: string;
}

export interface FoodOverride extends FoodReference {
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export class HealthierDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, "id">;
  bodyMetrics!: EntityTable<BodyMetric, "id">;
  meals!: EntityTable<StoredMeal, "id">;
  mealItems!: EntityTable<StoredMealItem, "id">;
  foodOverrides!: EntityTable<FoodOverride, "id">;
  settings!: EntityTable<AppSetting, "key">;

  constructor(name = "healthier-mvp") {
    super(name);
    this.version(1).stores({
      profiles: "id",
      bodyMetrics: "id, measuredAt",
      meals: "id, date, eatenAt, mealType",
      mealItems: "id, mealId, [mealId+tempId], category",
      foodOverrides: "id, name, category",
      settings: "key"
    });
  }
}

export const db = new HealthierDatabase();

export async function saveConfirmedMeal(meal: ConfirmedMeal): Promise<void> {
  const { items, ...storedMeal } = meal;
  const storedItems: StoredMealItem[] = items.map((item) => ({
    ...item,
    id: `${meal.id}:${item.tempId}`,
    mealId: meal.id
  }));

  await db.transaction("rw", db.meals, db.mealItems, async () => {
    await db.meals.put(storedMeal);
    await db.mealItems.where("mealId").equals(meal.id).delete();
    if (storedItems.length > 0) await db.mealItems.bulkPut(storedItems);
  });
}

export async function deleteMeal(mealId: string): Promise<void> {
  await db.transaction("rw", db.meals, db.mealItems, async () => {
    await db.meals.delete(mealId);
    await db.mealItems.where("mealId").equals(mealId).delete();
  });
}

export async function loadMealsForDate(date: string): Promise<ConfirmedMeal[]> {
  const meals = await db.meals.where("date").equals(date).sortBy("eatenAt");
  const result: ConfirmedMeal[] = [];
  for (const meal of meals) {
    const items = await db.mealItems.where("mealId").equals(meal.id).toArray();
    result.push({ ...meal, items });
  }
  return result;
}

export async function loadMealsBetween(startDate: string, endDate: string): Promise<ConfirmedMeal[]> {
  const meals = await db.meals
    .where("date")
    .between(startDate, endDate, true, true)
    .sortBy("eatenAt");
  const items = await db.mealItems.toArray();
  const itemsByMeal = new Map<string, StoredMealItem[]>();
  items.forEach((item) => {
    const current = itemsByMeal.get(item.mealId) ?? [];
    current.push(item);
    itemsByMeal.set(item.mealId, current);
  });
  return meals.map((meal) => ({ ...meal, items: itemsByMeal.get(meal.id) ?? [] }));
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.settings.get(key);
  return setting ? setting.value as T : fallback;
}

