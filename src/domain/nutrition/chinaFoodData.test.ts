import { describe, expect, it } from "vitest";
import { CHINA_FOODS } from "./chinaFoodData";

describe("curated China food composition data", () => {
  it("收录六十六个来源可直达的人工核验条目", () => {
    expect(CHINA_FOODS).toHaveLength(66);
    expect(new Set(CHINA_FOODS.map((food) => food.id)).size).toBe(66);
    expect(CHINA_FOODS.filter((food) => food.nutrientsPer100)).toHaveLength(32);
    expect(CHINA_FOODS.filter((food) => food.partialNutrientsPer100)).toHaveLength(34);

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

  it("新增高频蔬菜、菌菇、鱼类和腌腊食品保留官方口径", () => {
    expect(CHINA_FOODS.find((food) => food.id === "china-purple-cabbage-raw")?.nutrientsPer100)
      .toEqual({ kcal: 25, protein: 1.2, fat: 0.2, carb: 6.2, fiber: 3 });
    expect(CHINA_FOODS.find((food) => food.id === "china-shiitake-fresh-raw")?.partialNutrientsPer100)
      .toEqual({ kcal: 26, protein: 2.2, fat: 0.3, carb: 5.2 });
    expect(CHINA_FOODS.find((food) => food.id === "china-grass-carp-raw")).toMatchObject({
      name: "草鱼（生，可食部）",
      partialNutrientsPer100: { kcal: 114, protein: 16.6, fat: 5.2 }
    });
    expect(CHINA_FOODS.find((food) => food.id === "china-cod-baked")?.nutrientsPer100)
      .toEqual({ kcal: 101, protein: 21.4, fat: 1.2, carb: 0.8, fiber: 0 });
    expect(CHINA_FOODS.find((food) => food.id === "china-cod-fried")?.nutrientsPer100)
      .toEqual({ kcal: 247, protein: 12.4, fat: 14.3, carb: 17.4, fiber: 0.4 });
    expect(CHINA_FOODS.find((food) => food.id === "china-cured-sausage")?.partialNutrientsPer100)
      .toEqual({ kcal: 579, protein: 22, fat: 48.3, carb: 15.3 });
    expect(CHINA_FOODS.find((food) => food.id === "china-ham-sausage")?.partialNutrientsPer100)
      .toEqual({ kcal: 212, protein: 14, fat: 10.4, carb: 15.6 });

    for (const id of ["china-purple-cabbage-raw", "china-cod-baked", "china-cured-sausage"]) {
      expect(CHINA_FOODS.find((food) => food.id === id)?.source.release).toContain("2026-09-02");
    }
  });
});
