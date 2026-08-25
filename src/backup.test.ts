import { afterEach, describe, expect, it } from "vitest";
import { decryptBackup, exportEncryptedBackup, restoreBackup } from "./backup";
import { db } from "./db";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("encrypted backup", () => {
  it("使用PBKDF2和AES-GCM完成中文数据往返", async () => {
    await db.settings.put({ key: "备注", value: "早餐吃得不错" });

    const encrypted = await exportEncryptedBackup("correct-password");
    expect(encrypted).not.toContain("早餐吃得不错");
    const envelope = JSON.parse(encrypted) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      format: "HD-BACKUP-1",
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 310000 },
      cipher: { name: "AES-GCM", length: 256 }
    });

    const payload = await decryptBackup(encrypted, "correct-password");
    expect(payload.settings).toContainEqual({ key: "备注", value: "早餐吃得不错" });
  });

  it("错误密码不修改现有数据", async () => {
    await db.settings.put({ key: "original", value: true });
    const encrypted = await exportEncryptedBackup("correct-password");

    await expect(decryptBackup(encrypted, "wrong-password")).rejects.toThrow("密码错误或备份文件已经损坏");
    expect(await db.settings.get("original")).toEqual({ key: "original", value: true });
  });

  it("校验后的恢复采用整体替换", async () => {
    await db.settings.put({ key: "from-backup", value: "保留" });
    const encrypted = await exportEncryptedBackup("correct-password");
    const payload = await decryptBackup(encrypted, "correct-password");
    await db.settings.put({ key: "local-only", value: "应删除" });

    await restoreBackup(payload, "correct-password");

    expect(await db.settings.get("from-backup")).toEqual({ key: "from-backup", value: "保留" });
    expect(await db.settings.get("local-only")).toBeUndefined();
    const rollback = await db.settings.get("restoreRollback");
    expect(typeof rollback?.value).toBe("string");
    const rollbackPayload = await decryptBackup(rollback?.value as string, "correct-password");
    expect(rollbackPayload.settings).toContainEqual({ key: "local-only", value: "应删除" });
  });
});
