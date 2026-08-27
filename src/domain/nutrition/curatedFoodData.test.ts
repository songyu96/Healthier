import { describe, expect, it } from "vitest";
import { FNDDS_FOODS } from "./curatedFoodData";

describe("curated FNDDS food data", () => {
  it("同时提供组合成品和包装食品", () => {
    expect(FNDDS_FOODS.filter((food) => food.foodKind === "COMPOSITE")).toHaveLength(5);
    expect(FNDDS_FOODS.filter((food) => food.foodKind === "PACKAGED")).toHaveLength(6);
  });

  it("每个条目都有唯一 FDC ID、完整营养值和版本", () => {
    const sourceRefs = FNDDS_FOODS.map((food) => food.source.ref);
    expect(new Set(sourceRefs).size).toBe(FNDDS_FOODS.length);

    FNDDS_FOODS.forEach((food) => {
      expect(food.source.kind).toBe("USDA_FDC");
      expect(food.source.method).toBe("OFFICIAL_COMPOSITION");
      expect(food.source.ref).toMatch(/^FDC:\d+$/);
      expect(food.source.release).toBe("USDA FNDDS 2017–2018");
      expect(food.nutrientsPer100).toEqual({
        kcal: expect.any(Number),
        protein: expect.any(Number),
        fat: expect.any(Number),
        carb: expect.any(Number),
        fiber: expect.any(Number)
      });
      expect(food.dataCaveats?.length).toBeGreaterThan(0);
    });
  });

  it("可乐明确记录克到毫升的近似换算", () => {
    const cola = FNDDS_FOODS.find((food) => food.id === "soft-drink-cola");
    expect(cola?.basisUnit).toBe("ml");
    expect(cola?.dataCaveats?.join("")).toContain("1克≈1毫升");
  });
});
