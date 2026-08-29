import { describe, expect, it } from "vitest";
import { BUILT_IN_FOODS, mergeFoodRegistry } from "./foodRegistry";

describe("food registry", () => {
  it("统一注册四套数据且ID全局唯一", () => {
    expect(BUILT_IN_FOODS).toHaveLength(208);
    expect(new Set(BUILT_IN_FOODS.map((food) => food.id)).size).toBe(BUILT_IN_FOODS.length);
    expect(BUILT_IN_FOODS.some((food) => food.id === "china-crucian-carp-raw")).toBe(true);
    expect(BUILT_IN_FOODS.some((food) => food.id === "hamburger-generic-recipe")).toBe(true);
  });

  it("本地覆盖按ID替换统一注册表条目", () => {
    const base = BUILT_IN_FOODS[0];
    const merged = mergeFoodRegistry([{ ...base, name: "本地名称" }]);
    expect(merged.find((food) => food.id === base.id)?.name).toBe("本地名称");
    expect(merged).toHaveLength(BUILT_IN_FOODS.length);
  });
});
