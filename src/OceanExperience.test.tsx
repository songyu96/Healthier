import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import OceanExperience from "./OceanExperience";
import type { OceanSceneProps } from "./OceanScene";

const props: OceanSceneProps = { progress: 0.5, avatarStyle: "FEMALE", pace: "STEADY", proportions: { bodyWidth: 1, strokeReach: 1 }, luminousWater: false, dolphin: false, butterfly: false };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("ocean experience", () => {
  it("只展示轻量海洋场景，不提供 3D 入口", async () => {
    await act(async () => root.render(<OceanExperience {...props} />));
    expect(container.querySelector(".ocean-stage-art")).not.toBeNull();
    expect(container.textContent).toContain("50 / 100 分");
    expect(container.textContent).toContain("不会加载 3D 模型");
    expect(container.textContent).not.toContain("进入 3D 场景");
    expect(container.textContent).not.toContain("均衡画质");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("在轻量场景中保留角色和解锁奖励", async () => {
    await act(async () => root.render(<OceanExperience {...props} dolphin butterfly />));
    expect(container.querySelector(".avatar-female")).not.toBeNull();
    expect(container.querySelector(".ocean-dolphin")).not.toBeNull();
    expect(container.querySelector(".swimmer-glide")).not.toBeNull();
  });
});
