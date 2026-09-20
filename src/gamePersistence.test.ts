import { afterEach, describe, expect, it } from "vitest";
import { readBackupPayload, restoreBackup } from "./backup";
import { backupPayloadSchema } from "./backupSchemas";
import {
  addGameGoal,
  archiveGameGoal,
  db,
  deleteGameCheckin,
  GAME_STATE_SETTING_KEY,
  loadGameState,
  recordGameUnlocks,
  setGameCheckin,
  startGame,
  updateGameGoal
} from "./db";
import { goalVersionOn } from "./game";
import { calculateBusinessDataHash } from "./sync";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("ocean game persistence", () => {
  it("开启当天起算，目标修改下周一生效，停用保留历史打卡", async () => {
    await startGame("2026-08-26");
    await addGameGoal({ name: "阅读", category: "READING", weeklyFrequency: 3, minimumMinutes: 30 }, "2026-08-26");
    const goalId = (await loadGameState())!.goals[0].id;
    await setGameCheckin({ goalId, date: "2026-08-26", minutes: 15 }, "2026-08-26");
    await updateGameGoal(goalId, { name: "阅读", category: "READING", weeklyFrequency: 2, minimumMinutes: 20 }, "2026-08-26");
    let game = (await loadGameState())!;
    expect(goalVersionOn(game.goals[0], "2026-08-26")?.minimumMinutes).toBe(30);
    expect(goalVersionOn(game.goals[0], "2026-08-31")?.minimumMinutes).toBe(20);
    await archiveGameGoal(goalId, "2026-08-26");
    game = (await loadGameState())!;
    expect(game.goals[0].archivedOn).toBe("2026-08-27");
    expect(goalVersionOn(game.goals[0], "2026-08-26")?.minimumMinutes).toBe(30);
    expect(goalVersionOn(game.goals[0], "2026-08-27")).toBeUndefined();
    expect(game.checkins).toEqual([{ goalId, date: "2026-08-26", minutes: 15 }]);
    await deleteGameCheckin(goalId, "2026-08-26");
    expect((await loadGameState())!.checkins).toEqual([]);
  });

  it("解锁持久保存，备份和同步哈希包含游戏数据", async () => {
    const before = await readBackupPayload();
    const hashBefore = await calculateBusinessDataHash(before);
    await startGame("2026-08-26");
    await recordGameUnlocks(["FREESTYLE"]);
    const payload = await readBackupPayload();
    expect(payload.settings.find((setting) => setting.key === GAME_STATE_SETTING_KEY)?.value)
      .toMatchObject({ startedOn: "2026-08-26", unlocks: ["FREESTYLE"] });
    expect(await calculateBusinessDataHash(payload)).not.toBe(hashBefore);
    expect(backupPayloadSchema.safeParse(payload).success).toBe(true);
    const invalid = { ...payload, settings: [{ key: GAME_STATE_SETTING_KEY, value: { startedOn: "2026-08-26" } }] };
    expect(backupPayloadSchema.safeParse(invalid).success).toBe(false);
  });

  it("恢复旧的无游戏备份后默认为未开启", async () => {
    const oldPayload = await readBackupPayload();
    await startGame("2026-08-26");
    await restoreBackup(oldPayload, "correct-password");
    expect(await loadGameState()).toBeUndefined();
  });
});
