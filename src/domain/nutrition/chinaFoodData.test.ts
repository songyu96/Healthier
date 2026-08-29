import { describe, expect, it } from "vitest";
import { CHINA_FOODS } from "./chinaFoodData";

describe("curated China food composition data", () => {
  it("收录三十七个来源可直达的人工核验条目", () => {
    expect(CHINA_FOODS).toHaveLength(37);
    expect(new Set(CHINA_FOODS.map((food) => food.id)).size).toBe(37);
    expect(CHINA_FOODS.filter((food) => food.nutrientsPer100)).toHaveLength(29);
    expect(CHINA_FOODS.filter((food) => food.partialNutrientsPer100)).toHaveLength(8);

    CHINA_FOODS.forEach((food) => {
      expect(food.source).toMatchObject({
        kind: "REFERENCE",
        method: "OFFICIAL_COMPOSITION"
      });
      expect(food.source.ref).toMatch(/^https:\/\/nlc\.chinanutri\.cn\/fq\/foodinfo\/\d+\.html$/);
      const nutrients = food.nutrientsPer100 ?? food.partialNutrientsPer100;
      expect(nutrients?.kcal).toEqual(expect.any(Number));
      expect(nutrients?.protein).toEqual(expect.any(Number));
      expect(nutrients?.fat).toEqual(expect.any(Number));
      if (food.nutrientsPer100) {
        expect(nutrients?.carb).toEqual(expect.any(Number));
        expect(nutrients?.fiber).toEqual(expect.any(Number));
      }
      expect(food.dataCaveats?.some((caveat) => caveat.includes("kcal=4.184 kJ"))).toBe(true);
    });
  });

  it("保留官方页的关键五项值并正确换算能量", () => {
    expect(CHINA_FOODS.find((food) => food.id === "china-pork-bao")?.nutrientsPer100)
      .toEqual({ kcal: 231, protein: 7.3, fat: 10, carb: 28.6, fiber: 1.7 });
    expect(CHINA_FOODS.find((food) => food.id === "china-black-sesame-tangyuan")?.nutrientsPer100)
      .toEqual({ kcal: 315, protein: 4.4, fat: 13.8, carb: 44.2, fiber: 2 });
    expect(CHINA_FOODS.find((food) => food.id === "china-instant-noodles-braised-beef-dry")?.nutrientsPer100)
      .toEqual({ kcal: 451, protein: 10.2, fat: 17.9, carb: 62.6, fiber: 1.4 });
    expect(CHINA_FOODS.find((food) => food.id === "china-low-fat-cheese")?.nutrientsPer100)
      .toEqual({ kcal: 242, protein: 21.6, fat: 11.6, carb: 12.6, fiber: 0 });
    expect(CHINA_FOODS.find((food) => food.id === "china-prune-fresh")?.nutrientsPer100)
      .toEqual({ kcal: 42, protein: 0.7, fat: 0.1, carb: 10.3, fiber: 1.5 });
  });

  it("官方页缺失纤维时只保留已知字段", () => {
    const crucian = CHINA_FOODS.find((food) => food.id === "china-crucian-carp-raw");
    expect(crucian?.nutrientsPer100).toBeUndefined();
    expect(crucian?.partialNutrientsPer100)
      .toEqual({ kcal: 109, protein: 17.1, fat: 2.7, carb: 3.8 });
    expect(crucian?.dataCaveats?.join(" ")).toContain("膳食纤维");
  });
});
