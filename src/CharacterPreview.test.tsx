import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CharacterPreview from "./CharacterPreview";

vi.mock("./ocean/CharacterPreviewCanvas", () => ({default: function MockPreview(props: {avatarStyle:string;rotating:boolean;request:{view:string;revision:number};onReady:()=>void;onFailure:()=>void}) {
  const {onReady}=props;
  useEffect(() => { onReady(); }, [onReady]);
  return <div data-preview={props.avatarStyle} data-view={props.request.view} data-revision={props.request.revision} data-rotating={props.rotating}><button onClick={props.onFailure}>模拟预览失败</button></div>;
}}));
let host: HTMLDivElement, root: Root;
beforeEach(() => { host=document.createElement("div");document.body.append(host);root=createRoot(host); });
afterEach(async () => { await act(async()=>root.unmount());host.remove(); });
async function click(label:string) {
  const button=[...host.querySelectorAll("button")].find(button=>button.textContent===label);
  expect(button).toBeDefined();
  await act(async()=>button!.click());
}
describe("character inspection", () => {
  it("按需加载、默认静止；切换角度停止旋转，换角色与关闭预览正确生效", async () => {
    await act(async()=>root.render(<CharacterPreview avatarStyle="MALE" />));
    expect(host.querySelector("[data-preview]")).toBeNull();
    await click("查看 3D 角色");
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.rotating).toBe("false");
    await click("自动旋转");
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.rotating).toBe("true");
    await click("侧面");
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.view).toBe("SIDE");
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.rotating).toBe("false");
    await click("侧面");
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.revision).toBe("2");
    await click("面部近景");
    await act(async()=>root.render(<CharacterPreview avatarStyle="FEMALE" />));
    expect(host.querySelector<HTMLElement>("[data-preview]")?.dataset.preview).toBe("FEMALE");
    expect(host.textContent).toContain("新造型尚未上线");
    await click("收起角色预览");
    expect(host.querySelector("[data-preview]")).toBeNull();
  });
  it("未选角色时不能打开；加载失败有可读提示且仍可收起", async () => {
    await act(async()=>root.render(<CharacterPreview />));
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async()=>root.render(<CharacterPreview avatarStyle="FEMALE" />));
    await click("查看 3D 角色");
    await click("模拟预览失败");
    expect(host.textContent).toContain("你仍可选择角色并继续旅程");
    await click("收起角色预览");
    expect(host.textContent).not.toContain("角色预览暂不可用");
  });
});
