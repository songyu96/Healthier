import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OceanExperience from "./OceanExperience";
import type { OceanSceneProps } from "./OceanScene";

vi.mock("./ocean/OceanCanvas", () => ({
  default: function MockCanvas(props: { onReady: () => void; onFailure: () => void; paused: boolean; quality: string; cameraRequest: { view: string; revision: number }; avatarStyle: string }) {
    const { onReady } = props;
    useEffect(() => { onReady(); }, [onReady]);
    return <div data-testid="renderer" data-paused={props.paused} data-quality={props.quality} data-view={props.cameraRequest.view} data-revision={props.cameraRequest.revision} data-avatar={props.avatarStyle}><button onClick={props.onFailure}>模拟渲染失败</button></div>;
  }
}));

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
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => { root.render(<OceanExperience {...props} />); });
  await vi.waitFor(() => expect(container.querySelector('[data-testid="renderer"]')).not.toBeNull());
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
function renderer() { return container.querySelector<HTMLElement>('[data-testid="renderer"]')!; }

describe("ocean experience", () => {
  it("切换镜头、暂停、画质时保留角色，重复镜头按钮仍可复位", async () => {
    await mount();
    expect(container.textContent).not.toContain("正在驶入海湾");
    await click("俯瞰");
    expect(renderer().dataset.view).toBe("OVERHEAD");
    await click("俯瞰");
    expect(renderer().dataset.revision).toBe("2");
    await click("暂停动态");
    expect(renderer().dataset.paused).toBe("true");
    await click("均衡画质");
    expect(renderer().dataset.quality).toBe("LOW");
    expect(renderer().dataset.avatar).toBe("FEMALE");
    await click("继续动态");
    expect(renderer().dataset.paused).toBe("false");
  });
  it("渲染失败自动回退，提供刷新重试并保留原始进度", async () => {
    await mount();
    await click("模拟渲染失败");
    expect(renderer()).toBeNull();
    expect(container.textContent).toContain("已为你切换轻量场景");
    expect(container.textContent).toContain("50%");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "重新加载 3D")).toBe(true);
  });
  it("可以手动切换轻量场景并重新进入 3D", async () => {
    await mount();
    await click("轻量场景");
    expect(renderer()).toBeNull();
    await click("进入 3D 场景");
    expect(renderer()).not.toBeNull();
    expect(container.textContent).not.toContain("已为你切换轻量场景");
  });
  it("减少动态效果偏好默认暂停，可手动继续", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await mount();
    expect(renderer().dataset.paused).toBe("true");
    await click("继续动态");
    expect(renderer().dataset.paused).toBe("false");
  });
});
