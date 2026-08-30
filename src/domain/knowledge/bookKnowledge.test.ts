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
});
