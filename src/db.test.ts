import { afterEach, describe, expect, it } from "vitest";
import { db, deleteMeal, loadMealsForDate, saveConfirmedMeal } from "./db";
import type { ConfirmedMeal } from "./domain";

function sampleMeal(): ConfirmedMeal {
  return {
    id: "meal-test",
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
    updatedAt: "2026-08-25T08:30:00.000Z",
    items: [{
      tempId: "egg",
      name: "鸡蛋",
      category: "EG",
      state: "CK",
      quantityMin: 1,
      quantityMax: 1,
      unit: "pc"
    }]
  };
}

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("meal persistence", () => {
  it("保存后可重新读取完整餐食和中文食物名", async () => {
    await saveConfirmedMeal(sampleMeal());

    const loaded = await loadMealsForDate("2026-08-25");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].items[0].name).toBe("鸡蛋");
  });

  it("编辑时替换旧食物项，删除时同时清理食物项", async () => {
    const meal = sampleMeal();
    await saveConfirmedMeal(meal);
    await saveConfirmedMeal({
      ...meal,
      updatedAt: "2026-08-25T09:00:00.000Z",
      items: [{ ...meal.items[0], name: "水煮蛋" }]
    });

    expect((await loadMealsForDate("2026-08-25"))[0].items.map((item) => item.name)).toEqual(["水煮蛋"]);
    await deleteMeal(meal.id);
    expect(await loadMealsForDate("2026-08-25")).toEqual([]);
    expect(await db.mealItems.where("mealId").equals(meal.id).count()).toBe(0);
  });
});
