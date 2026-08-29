import { afterEach, describe, expect, it } from "vitest";
import { decryptBackup, exportEncryptedBackup, restoreBackup } from "./backup";
import { db } from "./db";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("backup boundary validation", () => {
  it("在密钥派生前拒绝被篡改的PBKDF2迭代次数", async () => {
    const encrypted = await exportEncryptedBackup("correct-password");
    const envelope = JSON.parse(encrypted) as { kdf: { iterations: number } };
    envelope.kdf.iterations = 999_999_999;

    await expect(decryptBackup(JSON.stringify(envelope), "correct-password")).rejects.toThrow();
  });

  it("保留食物类型、标签、饮品糖状态和数据限制元数据", async () => {
    await db.foodOverrides.put({
      id: "user-zero-soda",
      name: "常买零糖汽水",
      aliases: ["我的汽水"],
      foodKind: "PACKAGED",
      tags: ["无糖饮料", "包装食品"],
      beverageSugarProfile: "ZERO_SUGAR_SWEETENED",
      category: "SD",
      compatibleStates: ["PK"],
      basisUnit: "ml",
      nutrientsPer100: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 },
      dataCaveats: ["数据来自当前包装标签"],
      source: {
        kind: "USER",
        ref: "用户录入",
        release: "2026-08-26",
        method: "LABEL"
      },
      updatedAt: "2026-08-26T12:00:00.000Z"
    });

    const restored = await decryptBackup(await exportEncryptedBackup("correct-password"), "correct-password");

    expect(restored.foodOverrides[0]).toMatchObject({
      foodKind: "PACKAGED",
      tags: ["无糖饮料", "包装食品"],
      beverageSugarProfile: "ZERO_SUGAR_SWEETENED",
      dataCaveats: ["数据来自当前包装标签"],
      source: { method: "LABEL" }
    });
  });

  it("部分营养本地覆盖可备份并恢复且缺失字段不变成零", async () => {
    await db.foodOverrides.put({
      id: "user-partial-fish",
      name: "我的鲫鱼数据",
      aliases: ["鲫鱼"],
      category: "FI",
      compatibleStates: ["RW"],
      basisUnit: "g",
      partialNutrientsPer100: { kcal: 109, protein: 17.1, fat: 2.7, carb: 3.8 },
      source: { kind: "USER", ref: "用户录入", release: "2026-08-29", method: "USER" },
      updatedAt: "2026-08-29T12:00:00.000Z"
    });

    const payload = await decryptBackup(await exportEncryptedBackup("correct-password"), "correct-password");
    await db.foodOverrides.clear();
    await restoreBackup(payload, "correct-password");
    const restored = await db.foodOverrides.get("user-partial-fish");
    expect(restored?.partialNutrientsPer100).toEqual({
      kcal: 109, protein: 17.1, fat: 2.7, carb: 3.8
    });
    expect(restored?.partialNutrientsPer100?.fiber).toBeUndefined();
  });
});
