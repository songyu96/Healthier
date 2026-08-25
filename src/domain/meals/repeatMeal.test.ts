import { describe, expect, it } from "vitest";
import { createRepeatMealDraft } from "./repeatMeal";
import type { ConfirmedMeal } from "./types";

const meal: ConfirmedMeal = {
  id: "meal-1",
  protocolVersion: "HD1",
  eatenAt: "2026-08-24T08:00:00",
  date: "2026-08-24",
  mealType: "B",
  items: [{
    tempId: "old-item",
    name: "鸡蛋",
    category: "EG",
    state: "CK",
    quantityMin: 1,
    quantityMax: 1,
    unit: "pc",
    canonicalFoodId: "egg-cooked"
  }],
  cookingMethod: "水煮",
  note: "油盐未知",
  rawImportLine: "HD1|20260824-0800|B|鸡蛋~EG~CK~1-1pc|水煮|油盐未知",
  unknownOil: true,
  unknownSalt: true,
  ruleSetVersion: "book-rules-0.1",
  targetSnapshot: { energyKcal: 2100 },
  nutritionSnapshot: { energyKcal: 80 },
  nutritionSnapshotOrigin: "MIGRATED",
  createdAt: "2026-08-24T08:01:00.000Z",
  updatedAt: "2026-08-24T08:01:00.000Z"
};

describe("createRepeatMealDraft", () => {
  it("仅复制餐食内容并生成新的未保存草稿", () => {
    const draft = createRepeatMealDraft(
      meal,
      "2026-08-25T12:34:00",
      () => "new-item"
    );

    expect(draft.eatenAt).toBe("2026-08-25T12:34:00");
    expect(draft.date).toBe("2026-08-25");
    expect(draft.items[0]).toMatchObject({
      tempId: "new-item",
      name: "鸡蛋",
      canonicalFoodId: "egg-cooked"
    });
    expect(draft).not.toHaveProperty("id");
    expect(draft).not.toHaveProperty("targetSnapshot");
    expect(draft).not.toHaveProperty("nutritionSnapshot");
    expect(draft).not.toHaveProperty("nutritionSnapshotOrigin");
    expect(draft).not.toHaveProperty("createdAt");
    expect(draft).not.toHaveProperty("updatedAt");
    expect(meal.items[0].tempId).toBe("old-item");
  });
});
