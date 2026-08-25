import { afterEach, describe, expect, it } from "vitest";
import {
  db,
  deleteMeal,
  getDayCompletion,
  saveConfirmedMeal,
  setDayCompletion
} from "./db";
import { calculateTargets, type ConfirmedMeal, type UserProfile } from "./domain";

function sampleMeal(id = "meal-test", date = "2026-08-25"): ConfirmedMeal {
  return {
    id,
    protocolVersion: "HD1",
    eatenAt: `${date}T08:00:00`,
    date,
    mealType: "B",
    cookingMethod: "BOIL",
    note: "",
    rawImportLine: "HD1|20260825-0800|B|鸡蛋~EG~CK~1-1pc|BOIL|",
    unknownOil: false,
    unknownSalt: false,
    ruleSetVersion: "book-rules-0.1",
    createdAt: `${date}T08:30:00.000Z`,
    updatedAt: `${date}T08:30:00.000Z`,
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

function profile(heightCm: number): UserProfile {
  return {
    id: "default",
    heightCm,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags: [],
    updatedAt: "2026-08-25T08:00:00.000Z"
  };
}

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("day completion consistency", () => {
  it("无餐食时不能标记记录完整", async () => {
    await expect(setDayCompletion("2026-08-25", true)).rejects.toThrow("至少记录一餐");
    expect(await getDayCompletion("2026-08-25")).toBe(false);
  });

  it("餐食编辑和删除都会使完成标记失效", async () => {
    const meal = sampleMeal();
    await saveConfirmedMeal(meal);
    await setDayCompletion(meal.date, true);
    expect(await getDayCompletion(meal.date)).toBe(true);

    await saveConfirmedMeal({ ...meal, note: "修正", updatedAt: "2026-08-25T09:00:00.000Z" });
    expect(await getDayCompletion(meal.date)).toBe(false);

    await setDayCompletion(meal.date, true);
    await deleteMeal(meal.id);
    expect(await getDayCompletion(meal.date)).toBe(false);
  });

  it("跨日期编辑会使新旧两天的完成标记都失效", async () => {
    const original = sampleMeal();
    const destination = sampleMeal("meal-other", "2026-08-26");
    await saveConfirmedMeal(original);
    await saveConfirmedMeal(destination);
    await setDayCompletion(original.date, true);
    await setDayCompletion(destination.date, true);

    await saveConfirmedMeal({
      ...original,
      date: destination.date,
      eatenAt: "2026-08-26T09:00:00",
      updatedAt: "2026-08-26T09:10:00.000Z"
    });

    expect(await getDayCompletion(original.date)).toBe(false);
    expect(await getDayCompletion(destination.date)).toBe(false);
  });

  it("同一天只保留首次保存的目标快照", async () => {
    const firstTarget = calculateTargets(profile(175));
    const secondTarget = calculateTargets(profile(185));
    await saveConfirmedMeal({ ...sampleMeal(), targetSnapshot: firstTarget });
    await saveConfirmedMeal({
      ...sampleMeal("meal-second"),
      targetSnapshot: secondTarget
    });

    expect((await db.settings.get("dayTarget:2026-08-25"))?.value).toEqual(firstTarget);
  });

  it("跨日期移动统一采用目标日期快照并同步餐食", async () => {
    const sourceTarget = calculateTargets(profile(175));
    const destinationTarget = calculateTargets(profile(185));
    const currentTarget = calculateTargets(profile(178));
    const source = sampleMeal("meal-moving", "2026-08-25");

    await saveConfirmedMeal({ ...source, targetSnapshot: sourceTarget });
    await saveConfirmedMeal({
      ...sampleMeal("meal-destination", "2026-08-26"),
      targetSnapshot: destinationTarget
    });
    await saveConfirmedMeal({
      ...source,
      date: "2026-08-26",
      eatenAt: "2026-08-26T09:00:00",
      targetSnapshot: sourceTarget,
      updatedAt: "2026-08-26T09:10:00.000Z"
    });

    expect((await db.meals.get(source.id))?.targetSnapshot).toEqual(destinationTarget);

    await saveConfirmedMeal({
      ...source,
      date: "2026-08-27",
      eatenAt: "2026-08-27T09:00:00",
      targetSnapshot: currentTarget,
      updatedAt: "2026-08-27T09:10:00.000Z"
    });
    expect((await db.meals.get(source.id))?.targetSnapshot).toEqual(currentTarget);
    expect((await db.settings.get("dayTarget:2026-08-27"))?.value).toEqual(currentTarget);
  });
});
