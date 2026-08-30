import { describe, expect, it } from "vitest";
import { BOOK_CHAPTERS, bookLocationLabel, bookProgressPercent, chaptersForRule } from "./bookKnowledge";

const itemText = (items: { text: string }[] | undefined) => items?.map((item) => item.text).join(" ") ?? "";

describe("book knowledge", () => {
  it("核心章节编号和 EPUB 定位唯一且有效", () => {
    expect(BOOK_CHAPTERS).toHaveLength(36);
    expect(new Set(BOOK_CHAPTERS.map((chapter) => chapter.id)).size).toBe(BOOK_CHAPTERS.length);
    expect(new Set(BOOK_CHAPTERS.map((chapter) => `${chapter.source.bookId}:${chapter.source.epubFile}`)).size).toBe(BOOK_CHAPTERS.length);
    for (const chapter of BOOK_CHAPTERS) {
      expect(chapter.source.tocPosition).toBeGreaterThan(0);
      expect(chapter.source.tocPosition).toBeLessThanOrEqual(chapter.source.tocTotal);
      expect(bookProgressPercent(chapter.source)).toBeGreaterThanOrEqual(1);
      expect(bookProgressPercent(chapter.source)).toBeLessThanOrEqual(100);
      expect(chapter.coreIdea.length).toBeGreaterThan(10);
      expect(chapter.knowledgePoints.length).toBeGreaterThan(0);
      expect(["NUTRIENT", "MICRONUTRIENT", "FOOD_SELECTION", "MEAL_PLANNING", "RECORD_SAFETY"]).toContain(chapter.category);
      expect(chapter.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const item of [chapter.knowledgePoints, chapter.decisionRules, chapter.bookExamples, chapter.commonMisuses, chapter.appNotes, chapter.cautions].flatMap((items) => items ?? [])) {
        expect(["BOOK_DIRECT", "BOOK_CASE", "APP_DERIVED", "SAFETY"]).toContain(item.sourceKind);
      }
    }
  });

  it("位置说明使用目录项和百分比，不伪造 EPUB 页码", () => {
    const source = BOOK_CHAPTERS.find((chapter) => chapter.id === "B1-STRUCT")!.source;
    const label = bookLocationLabel(source);
    expect(label).toContain("EPUB目录第 8/141 项");
    expect(label).toContain("约全书 6% 位置");
    expect(label).not.toContain("页");
  });

  it("规则可以反查对应章节", () => {
    expect(chaptersForRule("BR-B-002").map((chapter) => chapter.id)).toEqual(["B1-BREAKFAST"]);
    expect(chaptersForRule("BR-A-002").map((chapter) => chapter.id)).toEqual(["B2-FLOW"]);
  });

  it("高信息密度章节保留书中数字、案例和应用边界", () => {
    const breakfast = BOOK_CHAPTERS.find((chapter) => chapter.id === "B1-BREAKFAST");
    expect(itemText(breakfast?.decisionRules)).toContain("1/3～1/2");
    expect(itemText(breakfast?.bookExamples)).toContain("700 kcal");
    expect(itemText(breakfast?.appNotes)).toContain("产品推导");

    const flow = BOOK_CHAPTERS.find((chapter) => chapter.id === "B2-FLOW");
    expect(itemText(flow?.knowledgePoints)).toContain("频率乘平均单次摄入量");
    expect(itemText(flow?.cautions)).toContain("不进入普通健康模式");
  });

  it("4个试用章节包含可直接判断的规则和常见误用", () => {
    for (const id of ["B1-ENERGY", "B1-BREAKFAST", "B1-HIDDEN-CARB", "B1-FRUIT"]) {
      const chapter = BOOK_CHAPTERS.find((item) => item.id === id);
      expect(chapter?.decisionRules?.length).toBeGreaterThanOrEqual(4);
      expect(chapter?.commonMisuses?.length).toBeGreaterThanOrEqual(4);
      expect(chapter?.knowledgePoints.length).toBeGreaterThanOrEqual(4);
      expect(itemText(chapter?.knowledgePoints)).toMatch(/书中|食物|能量|水果|主食/);
    }
  });

  it("案例、应用推导和安全边界不会伪装成书中明确规则", () => {
    const breakfast = BOOK_CHAPTERS.find((chapter) => chapter.id === "B1-BREAKFAST");
    expect(breakfast?.bookExamples?.every((item) => item.sourceKind === "BOOK_CASE")).toBe(true);
    expect(breakfast?.appNotes?.every((item) => item.sourceKind === "APP_DERIVED")).toBe(true);
    expect(BOOK_CHAPTERS.find((chapter) => chapter.id === "B2-FLOW")?.cautions?.every((item) => item.sourceKind === "SAFETY")).toBe(true);
  });

  it("知识分类覆盖营养素、微量营养素、食物、搭配和安全", () => {
    const counts = BOOK_CHAPTERS.reduce<Record<string, number>>((result, chapter) => {
      result[chapter.category] = (result[chapter.category] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({
      NUTRIENT: 7,
      MICRONUTRIENT: 11,
      FOOD_SELECTION: 11,
      MEAL_PLANNING: 6,
      RECORD_SAFETY: 1
    });
  });

  it("维生素和矿物质主题保留食物知识与安全边界", () => {
    for (const id of ["B1-VITAMIN-A", "B1-VITAMIN-D", "B1-VITAMIN-B", "B1-VITAMIN-C", "B1-CALCIUM", "B1-MAGNESIUM", "B1-IRON", "B1-ZINC", "B1-IODINE"]) {
      const chapter = BOOK_CHAPTERS.find((item) => item.id === id);
      expect(chapter?.category).toBe("MICRONUTRIENT");
      expect(chapter?.relatedRuleIds).toEqual([]);
      expect(chapter?.knowledgePoints.length).toBeGreaterThanOrEqual(5);
      expect(chapter?.cautions?.some((item) => item.sourceKind === "SAFETY")).toBe(true);
    }
    expect(itemText(BOOK_CHAPTERS.find((chapter) => chapter.id === "B1-IRON")?.knowledgePoints)).toContain("维生素C");
    expect(itemText(BOOK_CHAPTERS.find((chapter) => chapter.id === "B1-VITAMIN-A")?.knowledgePoints)).toContain("膳食脂肪");
  });
});
