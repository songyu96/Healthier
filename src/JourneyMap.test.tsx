import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JourneyMap from "./JourneyMap";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const week = { points: 42, dietPoints: 18, dietStatus: "已获得 18.0 分", goalEarnedSessions: 2, goalPlannedSessions: 3 };

describe("journey map", () => {
  it("显示十三个目的地、当前位置和下一站距离", async () => {
    await act(async () => root.render(<JourneyMap voyagePoints={175} recalculatedPoints={160} week={week} />));
    expect(container.querySelectorAll(".journey-node")).toHaveLength(13);
    expect(container.querySelector('[aria-current="location"]')?.textContent).toContain("海豚湾");
    expect(container.textContent).toContain("距 蝶翼灯塔 还差 125 分");
    expect(container.textContent).toContain("当前记录重算160 分");
    expect(container.textContent).toContain("当前处于航程保护期");
    expect(container.textContent).toContain("本周积分不等于本周地图前进积分");
  });

  it("锁定地点只显示预览，已到达休息岛可以靠岸且不产生写操作", async () => {
    await act(async () => root.render(<JourneyMap voyagePoints={100} recalculatedPoints={80} week={week} />));
    const locked = container.querySelector('button[aria-label^="风暴眼"]') as HTMLButtonElement;
    await act(async () => locked.click());
    expect(container.querySelector(".journey-destination.locked")).not.toBeNull();
    expect(container.textContent).toContain("继续积累到 600 分");

    const restIsland = container.querySelector('button[aria-label^="栖息岛"]') as HTMLButtonElement;
    await act(async () => restIsland.click());
    const restButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "靠岸休息")!;
    await act(async () => restButton.click());
    expect(container.textContent).toContain("栖息岛 · 靠岸休息");
    expect(container.textContent).toContain("休息不会扣分");
    expect(container.textContent).toContain("2 / 3 次");
  });

  it("没有个人目标时显示未设置", async () => {
    await act(async () => root.render(<JourneyMap
      voyagePoints={100}
      recalculatedPoints={100}
      week={{ ...week, goalEarnedSessions: 0, goalPlannedSessions: 0 }}
    />));
    const restButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "靠岸休息")!;
    await act(async () => restButton.click());
    expect(container.textContent).toContain("未设置");
    expect(container.textContent).not.toContain("航程保护期");
  });
});
