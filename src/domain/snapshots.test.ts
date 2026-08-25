import { describe, expect, it } from "vitest";
import { BASE_FOODS } from "./nutrition/foodData";
import {
  applyCurrentSafetyAdmission,
  calculateNutrition,
  calculateTargets,
  nutritionFactsForMeal,
  resolveDailyTargets,
  type ConfirmedMeal,
  type UserProfile
} from ".";

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

function meal(): ConfirmedMeal {
  return {
    id: "snapshot-meal",
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

describe("historical snapshots", () => {
  it("食物库变化后优先使用保存时营养快照", () => {
    const original = meal();
    const snapshot = calculateNutrition(original, BASE_FOODS);
    const saved = { ...original, nutritionSnapshot: snapshot };
    const changedFoods = BASE_FOODS.map((food) => food.name === "鸡蛋" && food.nutrientsPer100
      ? { ...food, nutrientsPer100: { ...food.nutrientsPer100, kcal: food.nutrientsPer100.kcal * 10 } }
      : food);

    expect(nutritionFactsForMeal(saved, changedFoods)).toEqual(snapshot);
  });

  it("个人资料变化后优先使用历史目标快照", () => {
    const oldTargets = calculateTargets(profile(175));
    const currentTargets = calculateTargets(profile(185));
    const saved = { ...meal(), targetSnapshot: oldTargets };

    expect(resolveDailyTargets([saved], undefined, currentTargets)).toEqual(oldTargets);
  });

  it("历史数值目标固定，但新增健康标记实时触发安全门", () => {
    const historicalTargets = calculateTargets({
      ...profile(175), birthDate: "1990-01-01", dietPattern: "OMNIVORE"
    });
    const currentTargets = calculateTargets({
      ...profile(185), birthDate: "1990-01-01", dietPattern: "OMNIVORE", healthFlags: ["MEDICATION"]
    });
    const resolved = applyCurrentSafetyAdmission(historicalTargets, currentTargets);

    expect(resolved.energyKcal).toBe(historicalTargets.energyKcal);
    expect(resolved.safetyRestricted).toBe(true);
    expect(resolved.safetyMessages.join(" ")).toContain("正在用药");
  });

  it("取消健康标记后不沿用历史快照中的安全限制", () => {
    const historicalTargets = calculateTargets({
      ...profile(175), birthDate: "1990-01-01", dietPattern: "OMNIVORE", healthFlags: ["MEDICATION"]
    });
    const currentTargets = calculateTargets({
      ...profile(185), birthDate: "1990-01-01", dietPattern: "OMNIVORE"
    });
    const resolved = applyCurrentSafetyAdmission(historicalTargets, currentTargets);

    expect(resolved.energyKcal).toBe(historicalTargets.energyKcal);
    expect(resolved.safetyRestricted).toBe(false);
    expect(resolved.safetyMessages).toEqual([]);
  });
});
