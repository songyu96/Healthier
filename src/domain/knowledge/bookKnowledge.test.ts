import { describe, expect, it } from "vitest";
import { BOOK_CHAPTERS, bookLocationLabel, bookProgressPercent, chaptersForRule } from "./bookKnowledge";

describe("book knowledge", () => {
  it("核心章节编号和 EPUB 定位唯一且有效", () => {
    expect(BOOK_CHAPTERS).toHaveLength(24);
    expect(new Set(BOOK_CHAPTERS.map((chapter) => chapter.id)).size).toBe(BOOK_CHAPTERS.length);
    expect(new Set(BOOK_CHAPTERS.map((chapter) => `${chapter.source.bookId}:${chapter.source.epubFile}`)).size).toBe(BOOK_CHAPTERS.length);
    for (const chapter of BOOK_CHAPTERS) {
      expect(chapter.source.tocPosition).toBeGreaterThan(0);
      expect(chapter.source.tocPosition).toBeLessThanOrEqual(chapter.source.tocTotal);
      expect(bookProgressPercent(chapter.source)).toBeGreaterThanOrEqual(1);
      expect(bookProgressPercent(chapter.source)).toBeLessThanOrEqual(100);
      expect(chapter.coreIdea.length).toBeGreaterThan(10);
      expect(chapter.knowledgePoints.length + (chapter.decisionRules?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("位置说明使用目录项和百分比，不伪造 EPUB 页码", () => {
    const label = bookLocationLabel(BOOK_CHAPTERS[0].source);
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
    expect(breakfast?.decisionRules?.join(" ")).toContain("1/3～1/2");
    expect(breakfast?.bookExamples?.join(" ")).toContain("700 kcal");
    expect(breakfast?.appNotes?.join(" ")).toContain("产品推导");

    const flow = BOOK_CHAPTERS.find((chapter) => chapter.id === "B2-FLOW");
    expect(flow?.knowledgePoints.join(" ")).toContain("频率乘平均单次摄入量");
    expect(flow?.cautions?.join(" ")).toContain("不进入普通健康模式");
  });

  it("4个试用章节包含可直接判断的规则和常见误用", () => {
    for (const id of ["B1-ENERGY", "B1-BREAKFAST", "B1-HIDDEN-CARB", "B1-FRUIT"]) {
      const chapter = BOOK_CHAPTERS.find((item) => item.id === id);
      expect(chapter?.decisionRules?.length).toBeGreaterThanOrEqual(4);
      expect(chapter?.commonMisuses?.length).toBeGreaterThanOrEqual(4);
      expect(chapter?.knowledgePoints).toEqual([]);
    }
  });
});
