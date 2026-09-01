import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  FOOD_CATEGORIES,
  FOOD_STATE_LABELS,
  FOOD_STATES,
  MEAL_LABELS,
  MEAL_TYPES,
  QUANTITY_UNITS
} from "./types";
import { createHd1AiPrompt, createHd1ImagePrompt } from "./hd1Prompt";

describe("HD1 AI prompt", () => {
  it("包含全部合法餐次、分类、状态和单位", () => {
    const prompt = createHd1AiPrompt("2026-08-31");

    MEAL_TYPES.forEach((code) => expect(prompt).toContain(`${code}=${MEAL_LABELS[code]}`));
    FOOD_CATEGORIES.forEach((code) => expect(prompt).toContain(`${code}=${CATEGORY_LABELS[code]}`));
    FOOD_STATES.forEach((code) => expect(prompt).toContain(`${code}=${FOOD_STATE_LABELS[code]}`));
    QUANTITY_UNITS.forEach((unit) => expect(prompt).toContain(unit));
  });

  it("明确单行输出、重量范围、未知油盐和分隔符约束", () => {
    const prompt = createHd1AiPrompt("2026-08-31");

    expect(prompt).toContain("只输出一行 HD1 字符串");
    expect(prompt).toContain("合理范围");
    expect(prompt).toContain("油盐未知");
    expect(prompt).toContain("恰好包含6段");
    expect(prompt).toContain("参考日期：2026-08-31");
  });

  it("图片模式直接估计宽松范围并交给人工确认", () => {
    const prompt = createHd1ImagePrompt("2026-09-01T12:30");

    expect(prompt).toContain("不要向我提问");
    expect(prompt).toContain("只输出一行 HD1 字符串");
    expect(prompt).toContain("估计实际呈现的可食重量范围");
    expect(prompt).toContain("照片估计，油盐未知");
    expect(prompt).toContain("解析并人工确认");
    expect(prompt).toContain("参考本地日期时间：2026-09-01T12:30");
  });
});
