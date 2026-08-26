import { describe, expect, it } from "vitest";
import { BASE_FOODS } from "../nutrition/foodData";
import { parseHd1 } from "./hd1";
import { MEAL_TEMPLATES, createMealDraftFromTemplate } from "./mealTemplates";

describe("meal templates", () => {
  it("只引用现有且状态兼容的内置食物", () => {
    MEAL_TEMPLATES.forEach((template) => {
      template.items.forEach((item) => {
        const food = BASE_FOODS.find((candidate) => candidate.id === item.canonicalFoodId);
        expect(food, template.name + " 缺少食物 " + item.name).toBeDefined();
        expect(food?.compatibleStates, template.name + " 状态不兼容 " + item.name).toContain(item.state);
      });
    });
  });

  it("每次生成独立草稿并保留可重新解析的HD1来源", () => {
    const template = MEAL_TEMPLATES.find((item) => item.id === "rice-chicken-broccoli")!;
    const first = createMealDraftFromTemplate(template, "2026-08-26T12:30:00");
    const second = createMealDraftFromTemplate(template, "2026-08-26T12:30:00");

    expect(first.date).toBe("2026-08-26");
    expect(first.items.map((item) => item.tempId)).not.toEqual(second.items.map((item) => item.tempId));
    expect(first.rawImportLine).toContain("HD1|20260826-1230|L|");
    expect(parseHd1(first.rawImportLine)).toMatchObject({
      ok: true,
      value: {
        mealType: "L",
        unknownOil: true,
        unknownSalt: true
      }
    });
  });

  it("模板份量是可编辑范围而不是持久化目标", () => {
    const draft = createMealDraftFromTemplate(MEAL_TEMPLATES[0], "2026-08-26T08:00:00");

    expect(draft).not.toHaveProperty("targetSnapshot");
    expect(draft).not.toHaveProperty("nutritionSnapshot");
    expect(draft.items.every((item) => item.quantityMin <= item.quantityMax)).toBe(true);
  });
});

