import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { isNutritionFacts } from "./domain";
import { HealthierDatabase, type StoredMeal, type StoredMealItem } from "./db";

const STORE_SCHEMA = {
  profiles: "id",
  bodyMetrics: "id, measuredAt",
  meals: "id, date, eatenAt, mealType",
  mealItems: "id, mealId, [mealId+tempId], category",
  foodOverrides: "id, name, category",
  settings: "key"
};

const databaseNames: string[] = [];

function legacyMeal(): StoredMeal {
  return {
    id: "legacy-meal",
    protocolVersion: "HD1",
    eatenAt: "2026-08-25T08:00:00",
    date: "2026-08-25",
    mealType: "B",
    cookingMethod: "BOIL",
    note: "",
    rawImportLine: "HD1|20260825-0800|B|鸡蛋~EG~CK~1-1pc|BOIL|",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "book-rules-0.1",
    createdAt: "2026-08-25T08:30:00.000Z",
    updatedAt: "2026-08-25T08:30:00.000Z"
  };
}

function legacyItem(): StoredMealItem {
  return {
    id: "legacy-meal:egg",
    mealId: "legacy-meal",
    tempId: "egg",
    name: "鸡蛋",
    category: "EG",
    state: "CK",
    quantityMin: 1,
    quantityMax: 1,
    unit: "pc"
  };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("database v2 migration", () => {
  it("为v1旧餐食生成并标记迁移时营养快照", async () => {
    const name = `healthier-v1-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacy = new Dexie(name);
    legacy.version(1).stores(STORE_SCHEMA);
    await legacy.open();
    await legacy.table<StoredMeal>("meals").put(legacyMeal());
    await legacy.table<StoredMealItem>("mealItems").put(legacyItem());
    legacy.close();

    const upgraded = new HealthierDatabase(name);
    await upgraded.open();
    const migrated = await upgraded.meals.get("legacy-meal");

    expect(migrated?.nutritionSnapshotOrigin).toBe("MIGRATED");
    expect(isNutritionFacts(migrated?.nutritionSnapshot)).toBe(true);
    if (isNutritionFacts(migrated?.nutritionSnapshot)) {
      expect(migrated.nutritionSnapshot.complete).toBe(true);
      expect(migrated.nutritionSnapshot.totals.min.kcal).toBeGreaterThan(0);
    }
    upgraded.close();
  });
});
