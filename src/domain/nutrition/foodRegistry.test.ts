import { describe, expect, it } from "vitest";
import { BUILT_IN_FOODS, mergeFoodRegistry } from "./foodRegistry";

describe("food registry", () => {
  it("统一注册四套数据且ID全局唯一", () => {
    expect(BUILT_IN_FOODS).toHaveLength(237);
    expect(new Set(BUILT_IN_FOODS.map((food) => food.id)).size).toBe(BUILT_IN_FOODS.length);
    expect(BUILT_IN_FOODS.some((food) => food.id === "china-crucian-carp-raw")).toBe(true);
    expect(BUILT_IN_FOODS.some((food) => food.id === "hamburger-generic-recipe")).toBe(true);
    expect(BUILT_IN_FOODS.some((food) => food.id === "china-purple-cabbage-raw")).toBe(true);
    expect(BUILT_IN_FOODS.some((food) => food.id === "china-shiitake-fresh-raw")).toBe(true);
    expect(BUILT_IN_FOODS.some((food) => food.id === "china-cured-sausage")).toBe(true);
  });

  it("常见中国食物名不会误命中美式通用条目", () => {
    const matches = (input: string) => BUILT_IN_FOODS.filter((food) =>
      food.name === input || food.aliases.includes(input));

    expect(matches("香肠").map((food) => food.id)).toEqual(["china-pork-sausage"]);
    expect(matches("火腿肠").map((food) => food.id)).toEqual(["china-ham-sausage"]);
    expect(matches("腊肠").map((food) => food.id)).toEqual(["china-cured-sausage"]);
  });

  it("本地覆盖按ID替换统一注册表条目", () => {
    const base = BUILT_IN_FOODS[0];
    const merged = mergeFoodRegistry([{ ...base, name: "本地名称" }]);
    expect(merged.find((food) => food.id === base.id)?.name).toBe("本地名称");
    expect(merged).toHaveLength(BUILT_IN_FOODS.length);
  });
});
