import { afterEach, describe, expect, it } from "vitest";
import {
  db,
  getDayCompletion,
  getSetting,
  loadMealsForDate,
  saveConfirmedMeal,
  setDayCompletion
} from "./db";
import {
  calculateNutrition,
  calculateTargets,
  createRepeatMealDraft,
  resolveDailyTargets,
  type ConfirmedMeal,
  type UserProfile
} from "./domain";
import { BASE_FOODS } from "./domain/nutrition/foodData";

const DATE = "2026-08-25";

function profile(heightCm: number): UserProfile {
  return {
    id: "default",
    birthDate: "1990-01-01",
    dietPattern: "OMNIVORE",
    dailyExercise: "NONE",
    dietHabitSummary: "三餐规律",
    heightCm,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags: [],
    updatedAt: `${DATE}T07:00:00.000Z`
  };
}

function sourceMeal(): ConfirmedMeal {
  const meal: ConfirmedMeal = {
    id: "source-meal",
    protocolVersion: "HD1",
    eatenAt: `${DATE}T08:00:00`,
    date: DATE,
    mealType: "B",
    items: [{
      tempId: "source-egg",
      name: "鸡蛋",
      category: "EG",
      state: "CK",
      quantityMin: 1,
      quantityMax: 1,
      unit: "pc"
    }],
    cookingMethod: "水煮",
    note: "来源餐食",
    rawImportLine: "HD1|20260825-0800|B|鸡蛋~EG~CK~1-1pc|水煮|油盐未知",
    unknownOil: true,
    unknownSalt: true,
    ruleSetVersion: "book-rules-0.1",
    targetSnapshot: calculateTargets(profile(175)),
    nutritionSnapshotOrigin: "MIGRATED",
    createdAt: `${DATE}T08:01:00.000Z`,
    updatedAt: `${DATE}T08:01:00.000Z`
  };
  return { ...meal, nutritionSnapshot: calculateNutrition(meal, BASE_FOODS) };
}

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("repeat meal persistence", () => {
  it("保存重复餐食时保留来源、使用当日目标并重新生成快照", async () => {
    const source = sourceMeal();
    await saveConfirmedMeal(source);
    await setDayCompletion(DATE, true);

    const draft = createRepeatMealDraft(
      source,
      `${DATE}T12:30:00`,
      () => "repeated-egg"
    );
    const storedDayTarget = await getSetting<unknown>(`dayTarget:${DATE}`, undefined);
    const targetSnapshot = resolveDailyTargets(
      [],
      storedDayTarget,
      calculateTargets(profile(185))
    );
    const mealWithoutNutrition: ConfirmedMeal = {
      ...draft,
      id: "repeated-meal",
      ruleSetVersion: targetSnapshot.ruleSetVersion,
      targetSnapshot,
      createdAt: `${DATE}T12:31:00.000Z`,
      updatedAt: `${DATE}T12:31:00.000Z`
    };
    const repeated: ConfirmedMeal = {
      ...mealWithoutNutrition,
      nutritionSnapshot: calculateNutrition(mealWithoutNutrition, BASE_FOODS),
      nutritionSnapshotOrigin: "CONFIRMED"
    };

    await saveConfirmedMeal(repeated);

    const savedMeals = await loadMealsForDate(DATE);
    const savedSource = savedMeals.find((meal) => meal.id === source.id);
    const savedRepeated = savedMeals.find((meal) => meal.id === repeated.id);

    expect(savedMeals).toHaveLength(2);
    expect(savedSource).toMatchObject({
      id: "source-meal",
      nutritionSnapshotOrigin: "MIGRATED",
      rawImportLine: source.rawImportLine
    });
    expect(savedRepeated).toMatchObject({
      id: "repeated-meal",
      eatenAt: `${DATE}T12:30:00`,
      date: DATE,
      targetSnapshot: source.targetSnapshot,
      nutritionSnapshotOrigin: "CONFIRMED",
      rawImportLine: source.rawImportLine
    });
    expect(savedRepeated?.items[0].tempId).toBe("repeated-egg");
    expect(savedRepeated?.nutritionSnapshot).toEqual(
      calculateNutrition(savedRepeated!, BASE_FOODS)
    );
    expect(savedRepeated?.nutritionSnapshot).not.toEqual(source.nutritionSnapshot);
    expect(await getDayCompletion(DATE)).toBe(false);
  });
});
