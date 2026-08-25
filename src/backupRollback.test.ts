import { afterEach, describe, expect, it } from "vitest";
import { decryptBackup, readBackupPayload, restoreBackup } from "./backup";
import { isNutritionFacts } from "./domain";
import { db, type StoredMeal, type StoredMealItem } from "./db";

function legacyMeal(): StoredMeal {
  return {
    id: "legacy-backup-meal",
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
    id: "legacy-backup-meal:egg",
    mealId: "legacy-backup-meal",
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
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("backup migration and rollback boundary", () => {
  it("普通备份排除瞬态恢复回滚点", async () => {
    await db.settings.put({ key: "restoreRollback", value: "temporary-ciphertext" });
    const payload = await readBackupPayload();
    expect(payload.settings.some((setting) => setting.key === "restoreRollback")).toBe(false);
  });

  it("恢复无快照旧备份时生成迁移快照", async () => {
    await db.meals.put(legacyMeal());
    await db.mealItems.put(legacyItem());
    const payload = await readBackupPayload();

    await restoreBackup(payload, "rollback-password");

    const restored = await db.meals.get("legacy-backup-meal");
    expect(restored?.nutritionSnapshotOrigin).toBe("MIGRATED");
    expect(isNutritionFacts(restored?.nutritionSnapshot)).toBe(true);
  });

  it("连续恢复生成的回滚备份不递归嵌套", async () => {
    await db.settings.put({ key: "phase", value: "A" });
    const payloadA = await readBackupPayload();
    await db.settings.put({ key: "phase", value: "B" });
    await db.settings.put({ key: "restoreRollback", value: "old-temporary-value" });

    await restoreBackup(payloadA, "rollback-password");
    const rollback1 = (await db.settings.get("restoreRollback"))?.value as string;
    const beforeFirstRestore = await decryptBackup(rollback1, "rollback-password");
    expect(beforeFirstRestore.settings).toContainEqual({ key: "phase", value: "B" });
    expect(beforeFirstRestore.settings.some((setting) => setting.key === "restoreRollback")).toBe(false);

    await restoreBackup(beforeFirstRestore, "rollback-password");
    const rollback2 = (await db.settings.get("restoreRollback"))?.value as string;
    const beforeSecondRestore = await decryptBackup(rollback2, "rollback-password");
    expect(beforeSecondRestore.settings).toContainEqual({ key: "phase", value: "A" });
    expect(beforeSecondRestore.settings.some((setting) => setting.key === "restoreRollback")).toBe(false);
  });
});
