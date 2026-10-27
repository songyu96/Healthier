import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import GamePage from "./GamePage";
import { AppProvider } from "./context/AppContext";
import { db, startGame, loadGameState, recordGameUnlocks } from "./db";
import { dateKey, GAME_UNLOCKS } from "./game";

vi.mock("./JourneyMap",()=>({default:({ voyagePoints }: { voyagePoints: number })=> <div>幻想群岛地图 · {voyagePoints} 分</div>}));

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("fantasy journey page", () => {
  it("展示群岛目标和永久图鉴，同时保留已解锁记录", async () => {
    await startGame(dateKey(new Date()),"MALE");
    await recordGameUnlocks(["DOLPHIN","BUTTERFLY"]);
    const before=await loadGameState();
    const container=document.createElement("div");document.body.append(container);
    const root=createRoot(container);
    try {
      await act(async()=>root.render(<MemoryRouter><AppProvider><GamePage /></AppProvider></MemoryRouter>));
      await vi.waitFor(()=>expect(container.textContent).toContain("本周航海任务"));
      expect(container.textContent).not.toContain("可核算里程");
      expect(container.textContent).toContain("幻想群岛地图");
      expect(container.textContent).toContain("旅行图鉴");
      expect(container.textContent).toContain("练习进度（按时长折算）");
      expect(container.textContent).toContain("未设置");
      expect(container.textContent).toContain("填写资料后评价");
      expect(container.textContent).toContain("海豚伙伴加入旅行图鉴");
      expect(container.textContent).not.toContain("游泳角色");
      expect(GAME_UNLOCKS.map(unlock=>unlock.threshold)).toEqual([50,150,300]);
      const migrated = await loadGameState();
      expect(migrated?.unlocks).toEqual(expect.arrayContaining(before?.unlocks ?? []));
      expect(migrated).toMatchObject({ voyagePoints: 300 });
    } finally { await act(async()=>root.unmount());container.remove(); }
  });
  it("新用户不选择角色也能开启旅程", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<MemoryRouter><AppProvider><GamePage /></AppProvider></MemoryRouter>));
      await vi.waitFor(() => expect(container.textContent).toContain("开启群岛旅程"));
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "开启群岛旅程")!;
      await act(async () => button.click());
      await vi.waitFor(() => expect(loadGameState()).resolves.toMatchObject({ voyagePoints: 0 }));
      expect((await loadGameState())?.avatarStyle).toBeUndefined();
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
  it("导入未来开始日期时显示等待提示，不访问不存在的当前周", async () => {
    await startGame("2099-01-01");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(<MemoryRouter><AppProvider><GamePage /></AppProvider></MemoryRouter>);
      });
      await vi.waitFor(() => expect(container.textContent).toContain("等待旅程开始"));
      expect(container.textContent).toContain("2099-01-01");
      expect(container.textContent).not.toContain("当前可核算里程");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
