import { afterEach, describe, expect, it } from "vitest";
import {
  readBackupPayload,
  restoreBackup,
  type BackupPayload
} from "./backup";
import { backupPayloadSchema } from "./backupSchemas";
import { db } from "./db";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

async function expectRejectedWithoutDataLoss(raw: unknown): Promise<void> {
  await db.settings.put({ key: "original", value: "保留" });
  await expect(restoreBackup(raw as BackupPayload, "rollback-password")).rejects.toThrow();
  expect(await db.settings.get("original")).toEqual({ key: "original", value: "保留" });
}

describe("backup semantic validation", () => {
  it("v1 Payload通过语义校验后显式迁移为v2", async () => {
    const current = await readBackupPayload();
    const migrated = backupPayloadSchema.parse({ ...current, schemaVersion: 1 });
    expect(migrated.schemaVersion).toBe(2);
  });

  it("拒绝缺字段或非法活动级别的档案", async () => {
    const payload = await readBackupPayload();
    const invalid = {
      ...payload,
      profiles: [{
        id: "default",
        heightCm: 175,
        currentWeightKg: 70,
        activityLevel: "OFFICE",
        overweightAdjustmentEnabled: false,
        healthFlags: [],
        updatedAt: new Date().toISOString()
      }]
    };
    await expectRejectedWithoutDataLoss(invalid);
  });

  it("拒绝引用不存在餐食的孤儿食物项", async () => {
    const payload = await readBackupPayload();
    const invalid = {
      ...payload,
      mealItems: [{
        id: "missing:item-1",
        mealId: "missing",
        tempId: "item-1",
        name: "米饭",
        category: "GR",
        state: "CK",
        quantityMin: 100,
        quantityMax: 100,
        unit: "g"
      }]
    };
    await expectRejectedWithoutDataLoss(invalid);
  });

  it("拒绝已知设置键的错误值类型", async () => {
    const payload = await readBackupPayload();
    await expectRejectedWithoutDataLoss({
      ...payload,
      settings: [{ key: "water:2026-08-25", value: "很多" }]
    });
  });

  it("拒绝快照tempId与真实餐食项不一致", async () => {
    const payload = await readBackupPayload();
    const mealId = "meal-snapshot-mismatch";
    const invalid = {
      ...payload,
      meals: [{
        id: mealId,
        protocolVersion: "HD1",
        eatenAt: "2026-08-25T08:00:00",
        date: "2026-08-25",
        mealType: "B",
        cookingMethod: "BOIL",
        note: "",
        rawImportLine: "test",
        unknownOil: false,
        unknownSalt: false,
        ruleSetVersion: "book-rules-0.1",
        nutritionSnapshot: {
          mealId,
          totals: {
            min: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 },
            max: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 }
          },
          items: [],
          unknownItems: [{ tempId: "snapshot-only", name: "米饭", reason: "未知" }],
          sourceRefs: [],
          complete: false,
          knownItemCount: 0,
          totalItemCount: 1
        },
        createdAt: "2026-08-25T08:01:00",
        updatedAt: "2026-08-25T08:01:00"
      }],
      mealItems: [{
        id: `${mealId}:actual-item`,
        mealId,
        tempId: "actual-item",
        name: "米饭",
        category: "GR",
        state: "CK",
        quantityMin: 100,
        quantityMax: 100,
        unit: "g"
      }]
    };

    await expectRejectedWithoutDataLoss(invalid);
  });
});
