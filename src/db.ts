import Dexie, { type EntityTable } from "dexie";
import {
  calculateNutrition,
  isDailyTargets,
  isNutritionFacts,
  type ConfirmedMeal,
  type FoodReference,
  type MealItemInput,
  type UserProfile
} from "./domain";
import { mergeFoodRegistry } from "./domain/nutrition/foodRegistry";

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

export const STORE_SCHEMA = {
  profiles: "id",
  bodyMetrics: "id, measuredAt",
  meals: "id, date, eatenAt, mealType",
  mealItems: "id, mealId, [mealId+tempId], category",
  foodOverrides: "id, name, category",
  settings: "key"
};

export const DATABASE_TABLE_NAMES = Object.keys(STORE_SCHEMA) as Array<keyof typeof STORE_SCHEMA>;

export function materializeMissingNutritionSnapshots(
  meals: StoredMeal[],
  mealItems: StoredMealItem[],
  foods: FoodReference[]
): StoredMeal[] {
  const itemsByMeal = new Map<string, StoredMealItem[]>();
  mealItems.forEach((item) => {
    const current = itemsByMeal.get(item.mealId) ?? [];
    current.push(item);
    itemsByMeal.set(item.mealId, current);
  });

  return meals.map((meal) => {
    if (isNutritionFacts(meal.nutritionSnapshot)) return meal;
    const items = itemsByMeal.get(meal.id) ?? [];
    return {
      ...meal,
      nutritionSnapshot: calculateNutrition({ id: meal.id, items }, foods),
      nutritionSnapshotOrigin: "MIGRATED"
    };
  });
}

export interface DayCompletion {
  completed: true;
  revision: number;
  completedAt: string;
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
    this.version(1).stores(STORE_SCHEMA);
    this.version(2).stores(STORE_SCHEMA).upgrade(async (transaction) => {
      const meals = await transaction.table<StoredMeal>("meals").toArray();
      const mealItems = await transaction.table<StoredMealItem>("mealItems").toArray();
      const overrides = await transaction.table<FoodOverride>("foodOverrides").toArray();
      const foods = mergeFoodRegistry(overrides);
      const migratedMeals = materializeMissingNutritionSnapshots(meals, mealItems, foods);
      if (migratedMeals.length > 0) {
        await transaction.table<StoredMeal>("meals").bulkPut(migratedMeals);
      }
    });
  }
}

export const db = new HealthierDatabase();

const dayRevisionKey = (date: string) => `dayRevision:${date}`;
const dayCompletionKey = (date: string) => `dayComplete:${date}`;
const dayTargetKey = (date: string) => `dayTarget:${date}`;

async function invalidateDay(date: string): Promise<void> {
  const revisionSetting = await db.settings.get(dayRevisionKey(date));
  const revision = typeof revisionSetting?.value === "number" && Number.isInteger(revisionSetting.value)
    ? revisionSetting.value
    : 0;
  await db.settings.put({ key: dayRevisionKey(date), value: revision + 1 });
  await db.settings.delete(dayCompletionKey(date));
}

export async function saveConfirmedMeal(meal: ConfirmedMeal): Promise<void> {
  if (meal.items.length === 0) throw new Error("餐食至少需要一个食物项。");
  const tempIds = meal.items.map((item) => item.tempId);
  if (tempIds.some((tempId) => !tempId.trim()) || new Set(tempIds).size !== tempIds.length) {
    throw new Error("餐食项 tempId 不能为空或重复。");
  }
  if (meal.nutritionSnapshot !== undefined) {
    if (!isNutritionFacts(meal.nutritionSnapshot)) {
      throw new Error("营养快照格式或计算语义无效。");
    }
    if (meal.nutritionSnapshot.mealId !== meal.id) {
      throw new Error("营养快照与餐食 ID 不一致。");
    }
    const snapshotTempIds = [
      ...meal.nutritionSnapshot.items.map((item) => item.tempId),
      ...meal.nutritionSnapshot.unknownItems.map((item) => item.tempId)
    ];
    const snapshotSet = new Set(snapshotTempIds);
    if (snapshotSet.size !== tempIds.length || tempIds.some((tempId) => !snapshotSet.has(tempId))) {
      throw new Error("营养快照与当前餐食项不一致。");
    }
  } else if (meal.nutritionSnapshotOrigin !== undefined) {
    throw new Error("营养快照来源缺少对应快照。");
  }
  const { items, ...mealWithoutItems } = meal;
  const storedMeal: StoredMeal = {
    ...mealWithoutItems,
    nutritionSnapshotOrigin: meal.nutritionSnapshot
      ? meal.nutritionSnapshotOrigin ?? "CONFIRMED"
      : undefined
  };
  const storedItems: StoredMealItem[] = items.map((item) => ({
    ...item,
    id: `${meal.id}:${item.tempId}`,
    mealId: meal.id
  }));

  await db.transaction("rw", db.meals, db.mealItems, db.settings, async () => {
    const existing = await db.meals.get(meal.id);
    const destinationTargetSetting = await db.settings.get(dayTargetKey(meal.date));
    const destinationTarget = isDailyTargets(destinationTargetSetting?.value)
      ? destinationTargetSetting.value
      : isDailyTargets(storedMeal.targetSnapshot) ? storedMeal.targetSnapshot : undefined;
    const alignedStoredMeal: StoredMeal = destinationTarget ? {
      ...storedMeal,
      ruleSetVersion: destinationTarget.ruleSetVersion,
      targetSnapshot: destinationTarget
    } : storedMeal;
    await db.meals.put(alignedStoredMeal);
    await db.mealItems.where("mealId").equals(meal.id).delete();
    if (storedItems.length > 0) await db.mealItems.bulkPut(storedItems);
    await invalidateDay(meal.date);
    if (existing && existing.date !== meal.date) await invalidateDay(existing.date);
    if (destinationTarget && !isDailyTargets(destinationTargetSetting?.value)) {
      await db.settings.put({ key: dayTargetKey(meal.date), value: destinationTarget });
    }
  });
}

export async function deleteMeal(mealId: string): Promise<void> {
  await db.transaction("rw", db.meals, db.mealItems, db.settings, async () => {
    const existing = await db.meals.get(mealId);
    await db.meals.delete(mealId);
    await db.mealItems.where("mealId").equals(mealId).delete();
    if (existing) await invalidateDay(existing.date);
  });
}

export async function setDayCompletion(date: string, completed: boolean): Promise<void> {
  await db.transaction("rw", db.meals, db.settings, async () => {
    if (!completed) {
      await db.settings.delete(dayCompletionKey(date));
      return;
    }
    if (await db.meals.where("date").equals(date).count() === 0) {
      throw new Error("至少记录一餐后才能标记当天记录完整。");
    }
    const revisionSetting = await db.settings.get(dayRevisionKey(date));
    const revision = typeof revisionSetting?.value === "number" && Number.isInteger(revisionSetting.value)
      ? revisionSetting.value
      : 0;
    const value: DayCompletion = { completed: true, revision, completedAt: new Date().toISOString() };
    await db.settings.put({ key: dayCompletionKey(date), value });
  });
}

export async function getDayCompletion(date: string): Promise<boolean> {
  const [completionSetting, revisionSetting] = await Promise.all([
    db.settings.get(dayCompletionKey(date)),
    db.settings.get(dayRevisionKey(date))
  ]);
  if (typeof completionSetting?.value === "boolean") return completionSetting.value;
  const completion = completionSetting?.value as Partial<DayCompletion> | undefined;
  const revision = typeof revisionSetting?.value === "number" && Number.isInteger(revisionSetting.value)
    ? revisionSetting.value
    : 0;
  return completion?.completed === true && completion.revision === revision;
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
  if (meals.length === 0) return [];
  const items = await db.mealItems.where("mealId").anyOf(meals.map((meal) => meal.id)).toArray();
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
