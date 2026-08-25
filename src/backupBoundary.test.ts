import { afterEach, describe, expect, it } from "vitest";
import { decryptBackup, exportEncryptedBackup } from "./backup";
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
});
