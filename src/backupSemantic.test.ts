import { afterEach, describe, expect, it } from "vitest";
import {
  readBackupPayload,
  restoreBackup,
  type BackupPayload
} from "./backup";
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
});
