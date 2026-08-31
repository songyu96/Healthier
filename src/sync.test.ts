import { afterEach, describe, expect, it } from "vitest";
import { readBackupPayload } from "./backup";
import { DATABASE_TABLE_NAMES, db } from "./db";
import {
  calculateBusinessDataHash,
  classifySyncImport,
  createSyncPackage,
  inspectSyncPackage,
  type LocalSyncState,
  type SyncPackage
} from "./sync";
import { settingSyncScope, TABLE_SYNC_SCOPE } from "./syncScope";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

const BASELINE_ID = "11111111-1111-4111-8111-111111111111";
const NEXT_ID = "22222222-2222-4222-8222-222222222222";
const UNRELATED_ID = "33333333-3333-4333-8333-333333333333";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function packageFor(versionId: string, parentVersionId: string | null): SyncPackage {
  return {
    format: "HD-SYNC-1",
    syncFormatVersion: 1,
    versionId,
    parentVersionId,
    createdAt: "2026-08-31T12:00:00.000Z",
    payloadSchemaVersion: 2,
    encryptedBackup: "encrypted"
  };
}

describe("sync scope", () => {
  it("每张Dexie表都明确声明同步范围", () => {
    expect(Object.keys(TABLE_SYNC_SCOPE).sort()).toEqual([...DATABASE_TABLE_NAMES].sort());
    expect(settingSyncScope("dayCompletion:2026-08-31")).toBe("SYNCED_BUSINESS_DATA");
    expect(settingSyncScope("sync:file-state")).toBe("LOCAL_ONLY");
    expect(settingSyncScope("restoreRollback")).toBe("TRANSIENT");
  });
});

describe("business data hash", () => {
  it("忽略导出时间、瞬态设置和数组顺序", async () => {
    await db.settings.bulkPut([
      { key: "z-setting", value: 2 },
      { key: "a-setting", value: 1 }
    ]);
    const payload = await readBackupPayload();
    const reordered = {
      ...payload,
      exportedAt: "2099-01-01T00:00:00.000Z",
      settings: [
        { key: "restoreRollback", value: "temporary" },
        { key: "sync:file-state", value: { deviceId: BASELINE_ID } },
        ...[...payload.settings].reverse()
      ]
    };

    await expect(calculateBusinessDataHash(reordered)).resolves.toBe(
      await calculateBusinessDataHash(payload)
    );
  });
});

describe("HD-SYNC-1", () => {
  it("将同一份业务数据加密封装并可解密检查", async () => {
    await db.settings.put({ key: "备注", value: "手机晚餐" });

    const created = await createSyncPackage("correct-password");
    expect(created.text).not.toContain("手机晚餐");
    expect(created.package).toMatchObject({
      format: "HD-SYNC-1",
      syncFormatVersion: 1,
      parentVersionId: null,
      payloadSchemaVersion: 2
    });

    const inspected = await inspectSyncPackage(created.text, "correct-password");
    expect(inspected.package.versionId).toBe(created.package.versionId);
    expect(inspected.businessDataHash).toBe(created.businessDataHash);
    expect(inspected.payload.settings).toContainEqual({ key: "备注", value: "手机晚餐" });
    await expect(inspectSyncPackage(created.text, "wrong-password"))
      .rejects.toThrow("密码错误或备份文件已经损坏");
  });

  it("拒绝外层声明与加密内容不一致的同步包", async () => {
    const created = await createSyncPackage("correct-password");
    const tampered = JSON.parse(created.text) as Record<string, unknown>;
    tampered.payloadSchemaVersion = 1;

    await expect(inspectSyncPackage(JSON.stringify(tampered), "correct-password"))
      .rejects.toThrow("同步包外层版本与加密数据不一致");
  });
});

describe("sync conflict classification", () => {
  const state: LocalSyncState = {
    deviceId: UNRELATED_ID,
    baselineVersionId: BASELINE_ID,
    baselineBusinessDataHash: HASH_A
  };

  it("只把干净本机上的直接后继版本视为远端更新", () => {
    expect(classifySyncImport(state, HASH_A, packageFor(NEXT_ID, BASELINE_ID)))
      .toBe("REMOTE_UPDATE");
    expect(classifySyncImport(state, HASH_B, packageFor(NEXT_ID, BASELINE_ID)))
      .toBe("CONFLICT");
    expect(classifySyncImport(state, HASH_A, packageFor(NEXT_ID, UNRELATED_ID)))
      .toBe("CONFLICT");
  });

  it("区分首次导入、相同版本和相同版本后的本机修改", () => {
    expect(classifySyncImport({ deviceId: UNRELATED_ID }, HASH_A, packageFor(NEXT_ID, null)))
      .toBe("FIRST_IMPORT");
    expect(classifySyncImport(state, HASH_A, packageFor(BASELINE_ID, null)))
      .toBe("SAME_VERSION");
    expect(classifySyncImport(state, HASH_B, packageFor(BASELINE_ID, null)))
      .toBe("CONFLICT");
  });
});
