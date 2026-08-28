import { describe, expect, it } from "vitest";
import { CHINA_FOODS } from "./chinaFoodData";

describe("curated China food composition data", () => {
  it("只收录九个五项营养值完整且来源可直达的条目", () => {
    expect(CHINA_FOODS).toHaveLength(9);
    expect(new Set(CHINA_FOODS.map((food) => food.id)).size).toBe(9);

    CHINA_FOODS.forEach((food) => {
      expect(food.source).toMatchObject({
        kind: "REFERENCE",
        method: "OFFICIAL_COMPOSITION"
      });
      expect(food.source.ref).toMatch(/^https:\/\/nlc\.chinanutri\.cn\/fq\/foodinfo\/\d+\.html$/);
      expect(food.nutrientsPer100).toEqual({
        kcal: expect.any(Number),
        protein: expect.any(Number),
        fat: expect.any(Number),
        carb: expect.any(Number),
        fiber: expect.any(Number)
      });
      expect(food.dataCaveats?.some((caveat) => caveat.includes("kcal=4.184 kJ"))).toBe(true);
    });
  });

  it("保留官方页的关键五项值并正确换算能量", () => {
    expect(CHINA_FOODS.find((food) => food.id === "china-pork-bao")?.nutrientsPer100)
      .toEqual({ kcal: 231, protein: 7.3, fat: 10, carb: 28.6, fiber: 1.7 });
    expect(CHINA_FOODS.find((food) => food.id === "china-black-sesame-tangyuan")?.nutrientsPer100)
      .toEqual({ kcal: 315, protein: 4.4, fat: 13.8, carb: 44.2, fiber: 2 });
  });
});
