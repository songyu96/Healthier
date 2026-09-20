import Dexie, { type EntityTable } from "dexie";
import { bodyMetricSchema } from "./backupSchemas";
import {
  calculateNutrition,
  FOOD_CATEGORIES,
  FOOD_STATES,
  isDailyTargets,
  isNutritionFacts,
  MEAL_TYPES,
  QUANTITY_UNITS,
  type ConfirmedMeal,
  type FoodReference,
  type MealItemInput,
  type ParsedMeal,
  type UserProfile
} from "./domain";
import { mergeFoodRegistry } from "./domain/nutrition/foodRegistry";
import { MEAL_DRAFT_SETTING_KEY } from "./syncScope";
import { goalVersionOn, nextWeekStart, shiftDate, type GameAvatarStyle, type GameCheckin, type GameGoalVersion, type GameState, type GameUnlockId } from "./game";
import { gameStateSchema, isGameDateKey } from "./gameSchema";

export { MEAL_DRAFT_SETTING_KEY } from "./syncScope";

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

export function isValidBodyMetric(value: unknown): value is BodyMetric {
  return bodyMetricSchema.safeParse(value).success;
}

export async function loadBodyMetrics(): Promise<BodyMetric[]> {
  return db.bodyMetrics.toArray();
}

export async function saveBodyMetric(metric: BodyMetric): Promise<void> {
  const validated = bodyMetricSchema.safeParse(metric);
  if (!validated.success) {
    const labels: Record<string, string> = {
      id: "记录ID",
      measuredAt: "日期",
      weightKg: "体重",
      waistCm: "腰围",
      note: "备注"
    };
    const details = validated.error.issues
      .map((issue) => `${labels[String(issue.path[0])] ?? String(issue.path[0])}：${issue.message}`)
      .join("；");
    throw new Error(`身体指标无法保存：${details}`);
  }
  await db.bodyMetrics.put(validated.data);
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isStoredDraftItem(value: unknown): value is MealItemInput {
  if (!isRecord(value)) return false;
  return typeof value.tempId === "string"
    && typeof value.name === "string"
    && FOOD_CATEGORIES.includes(value.category as MealItemInput["category"])
    && FOOD_STATES.includes(value.state as MealItemInput["state"])
    && typeof value.quantityMin === "number"
    && Number.isFinite(value.quantityMin)
    && typeof value.quantityMax === "number"
    && Number.isFinite(value.quantityMax)
    && QUANTITY_UNITS.includes(value.unit as MealItemInput["unit"])
    && (value.canonicalFoodId === undefined || typeof value.canonicalFoodId === "string");
}

export function isStoredMealDraft(value: unknown): value is ParsedMeal {
  if (!isRecord(value) || "id" in value) return false;
  return value.protocolVersion === "HD1"
    && typeof value.eatenAt === "string"
    && typeof value.date === "string"
    && MEAL_TYPES.includes(value.mealType as ParsedMeal["mealType"])
    && Array.isArray(value.items)
    && value.items.every(isStoredDraftItem)
    && typeof value.cookingMethod === "string"
    && typeof value.note === "string"
    && typeof value.rawImportLine === "string"
    && typeof value.unknownOil === "boolean"
    && typeof value.unknownSalt === "boolean";
}

export async function loadMealDraft(): Promise<ParsedMeal | undefined> {
  const value = await getSetting<unknown>(MEAL_DRAFT_SETTING_KEY, undefined);
  return isStoredMealDraft(value) ? value : undefined;
}

export async function saveMealDraft(draft: ParsedMeal): Promise<void> {
  if (!isStoredMealDraft(draft)) {
    throw new Error("只能持久化结构有效的新建餐食草稿。");
  }
  await setSetting(MEAL_DRAFT_SETTING_KEY, draft);
}

export async function clearMealDraft(): Promise<void> {
  await db.settings.delete(MEAL_DRAFT_SETTING_KEY);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.settings.get(key);
  return setting ? setting.value as T : fallback;
}

export const GAME_STATE_SETTING_KEY = "game:state";

export async function loadGameState(): Promise<GameState | undefined> {
  const setting = await db.settings.get(GAME_STATE_SETTING_KEY);
  return setting ? gameStateSchema.parse(setting.value) : undefined;
}

function requireGameDate(date: string): void {
  if (!isGameDateKey(date)) throw new Error("游戏日期无效。");
}

async function changeGameState(change: (state: GameState) => GameState): Promise<GameState> {
  return db.transaction("rw", db.settings, async () => {
    const state = await loadGameState();
    if (!state) throw new Error("请先开启海洋旅程。");
    const next = gameStateSchema.parse(change(state));
    await db.settings.put({ key: GAME_STATE_SETTING_KEY, value: next });
    return next;
  });
}

export async function startGame(date: string, avatarStyle?: GameAvatarStyle): Promise<GameState> {
  requireGameDate(date);
  return db.transaction("rw", db.settings, async () => {
    const existing = await loadGameState();
    if (existing) return existing;
    const state: GameState = { startedOn: date, ...(avatarStyle ? { avatarStyle } : {}), goals: [], checkins: [], unlocks: [] };
    await db.settings.put({ key: GAME_STATE_SETTING_KEY, value: state });
    return state;
  });
}

export async function setGameAvatarStyle(avatarStyle: GameAvatarStyle): Promise<GameState> {
  return changeGameState((state) => ({ ...state, avatarStyle }));
}

export async function addGameGoal(version: Omit<GameGoalVersion, "effectiveOn">, today: string): Promise<GameState> {
  requireGameDate(today);
  return changeGameState((state) => ({
    ...state,
    goals: [...state.goals, {
      id: crypto.randomUUID(),
      startedOn: today,
      versions: [{ ...version, effectiveOn: today }]
    }]
  }));
}

export async function updateGameGoal(
  goalId: string,
  version: Omit<GameGoalVersion, "effectiveOn">,
  today: string
): Promise<GameState> {
  requireGameDate(today);
  return changeGameState((state) => {
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal || !goalVersionOn(goal, today)) throw new Error("目标不存在或已停用。");
    const effectiveOn = nextWeekStart(today);
    return {
      ...state,
      goals: state.goals.map((item) => item.id === goalId ? {
        ...item,
        versions: [...item.versions.filter((entry) => entry.effectiveOn < effectiveOn), { ...version, effectiveOn }]
      } : item)
    };
  });
}

export async function archiveGameGoal(goalId: string, today: string): Promise<GameState> {
  requireGameDate(today);
  return changeGameState((state) => {
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal || !goalVersionOn(goal, today)) throw new Error("目标不存在或已停用。");
    return {
      ...state,
      goals: state.goals.map((item) => item.id === goalId ? { ...item, archivedOn: shiftDate(today, 1) } : item)
    };
  });
}

export async function setGameCheckin(checkin: GameCheckin, today: string): Promise<GameState> {
  requireGameDate(today);
  requireGameDate(checkin.date);
  if (checkin.date > today) throw new Error("不能提前打卡未来日期。");
  return changeGameState((state) => {
    const goal = state.goals.find((item) => item.id === checkin.goalId);
    if (!goal || !goalVersionOn(goal, checkin.date)) throw new Error("所选日期的目标无效。");
    return {
      ...state,
      checkins: [
        ...state.checkins.filter((item) => item.goalId !== checkin.goalId || item.date !== checkin.date),
        checkin
      ]
    };
  });
}

export async function deleteGameCheckin(goalId: string, date: string): Promise<GameState> {
  requireGameDate(date);
  return changeGameState((state) => ({
    ...state,
    checkins: state.checkins.filter((item) => item.goalId !== goalId || item.date !== date)
  }));
}

export async function recordGameUnlocks(unlocks: GameUnlockId[]): Promise<GameState> {
  return changeGameState((state) => ({
    ...state,
    unlocks: [...new Set([...state.unlocks, ...unlocks])]
  }));
}
