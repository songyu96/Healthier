import { afterEach, describe, expect, it } from "vitest";
import {
  clearMealDraft,
  db,
  deleteMeal,
  getDayCompletion,
  loadMealDraft,
  loadMealsForDate,
  MEAL_DRAFT_SETTING_KEY,
  saveBodyMetric,
  saveConfirmedMeal,
  saveMealDraft,
  setDayCompletion
} from "./db";
import { calculateNutrition, type ConfirmedMeal, type ParsedMeal } from "./domain";
import { BUILT_IN_FOODS } from "./domain/nutrition/foodRegistry";

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

function sampleDraft(): ParsedMeal {
  const meal = sampleMeal();
  return {
    protocolVersion: meal.protocolVersion,
    eatenAt: meal.eatenAt,
    date: meal.date,
    mealType: meal.mealType,
    items: meal.items,
    cookingMethod: meal.cookingMethod,
    note: meal.note,
    rawImportLine: meal.rawImportLine,
    unknownOil: meal.unknownOil,
    unknownSalt: meal.unknownSalt
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

  it("重新确认迁移餐食后把快照来源更新为CONFIRMED", async () => {
    const meal = sampleMeal();
    const nutritionSnapshot = calculateNutrition(meal, BUILT_IN_FOODS);
    await saveConfirmedMeal({
      ...meal,
      nutritionSnapshot,
      nutritionSnapshotOrigin: "MIGRATED"
    });
    expect((await db.meals.get(meal.id))?.nutritionSnapshotOrigin).toBe("MIGRATED");

    await saveConfirmedMeal({
      ...meal,
      note: "已重新确认",
      updatedAt: "2026-08-25T09:00:00.000Z",
      nutritionSnapshot: calculateNutrition(meal, BUILT_IN_FOODS),
      nutritionSnapshotOrigin: "CONFIRMED"
    });
    expect((await db.meals.get(meal.id))?.nutritionSnapshotOrigin).toBe("CONFIRMED");
  });

  it("拒绝快照餐食ID、餐食项集合或tempId重复且不改写原数据", async () => {
    const original = sampleMeal();
    const nutritionSnapshot = calculateNutrition(original, BUILT_IN_FOODS);
    await saveConfirmedMeal({ ...original, nutritionSnapshot });
    await setDayCompletion(original.date, true);

    await expect(saveConfirmedMeal({
      ...original,
      nutritionSnapshot: { ...nutritionSnapshot, mealId: "other-meal" }
    })).rejects.toThrow("餐食 ID");
    await expect(saveConfirmedMeal({
      ...original,
      items: [{ ...original.items[0], tempId: "changed" }],
      nutritionSnapshot
    })).rejects.toThrow("当前餐食项");
    await expect(saveConfirmedMeal({
      ...original,
      items: [original.items[0], { ...original.items[0] }],
      nutritionSnapshot: undefined
    })).rejects.toThrow("tempId");

    const persisted = (await loadMealsForDate(original.date))[0];
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0]).toMatchObject({ tempId: "egg", name: "鸡蛋" });
    expect(await getDayCompletion(original.date)).toBe(true);
  });
});

describe("meal draft persistence", () => {
  it("保存并恢复尚未完成的新建草稿", async () => {
    const base = sampleDraft();
    const draft = {
      ...base,
      items: [{ ...base.items[0], name: "", quantityMin: 0, quantityMax: 0 }]
    };

    await saveMealDraft(draft);

    await expect(loadMealDraft()).resolves.toEqual(draft);
  });

  it("忽略结构损坏的草稿", async () => {
    await db.settings.put({ key: MEAL_DRAFT_SETTING_KEY, value: { protocolVersion: "HD1", items: null } });

    await expect(loadMealDraft()).resolves.toBeUndefined();
  });

  it("编辑已有餐食不能覆盖新建草稿", async () => {
    const draft = sampleDraft();
    await saveMealDraft(draft);

    await expect(saveMealDraft(sampleMeal())).rejects.toThrow("新建餐食草稿");
    await expect(loadMealDraft()).resolves.toEqual(draft);
  });

  it("主动清除后不再恢复草稿", async () => {
    await saveMealDraft(sampleDraft());

    await clearMealDraft();

    await expect(loadMealDraft()).resolves.toBeUndefined();
  });
});

describe("body metric persistence", () => {
  const validMetric = {
    id: "metric-test",
    measuredAt: "2026-08-25T12:00:00",
    weightKg: 70,
    waistCm: 82,
    note: "正常记录"
  };

  it("校验通过后保存合法身体指标", async () => {
    await saveBodyMetric(validMetric);

    await expect(db.bodyMetrics.get(validMetric.id)).resolves.toEqual(validMetric);
  });

  it.each([
    ["空日期", { ...validMetric, measuredAt: "T12:00:00" }],
    ["非法时间", { ...validMetric, measuredAt: "2026-08-25T25:00:00" }],
    ["零体重", { ...validMetric, weightKg: 0 }],
    ["负体重", { ...validMetric, weightKg: -1 }],
    ["零腰围", { ...validMetric, waistCm: 0 }]
  ])("拒绝%s且不写入数据库", async (_label, metric) => {
    await expect(saveBodyMetric(metric)).rejects.toThrow("身体指标无法保存");
    await expect(db.bodyMetrics.get(validMetric.id)).resolves.toBeUndefined();
  });

  it("校验失败时不覆盖原有身体指标", async () => {
    await saveBodyMetric(validMetric);

    await expect(saveBodyMetric({ ...validMetric, weightKg: 0 })).rejects.toThrow("身体指标无法保存");
    await expect(db.bodyMetrics.get(validMetric.id)).resolves.toEqual(validMetric);
  });
});
