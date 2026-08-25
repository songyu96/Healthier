import { describe, expect, it } from "vitest";
import { parseHd1, validateMealDraft } from "./hd1";

describe("parseHd1", () => {
  it("解析合法的中文餐食字符串并保留范围", () => {
    const result = parseHd1(
      "HD1|20260824-1230|L|米饭~GR~CK~120-180g;西兰花~DV~CK~80-120g;鸡胸肉~MP~CK~60-90g|STIRFRY|油盐未知"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe("2026-08-24");
    expect(result.value.mealType).toBe("L");
    expect(result.value.items).toHaveLength(3);
    expect(result.value.items[0]).toMatchObject({
      name: "米饭",
      quantityMin: 120,
      quantityMax: 180,
      unit: "g"
    });
    expect(result.value.unknownOil).toBe(true);
    expect(result.value.unknownSalt).toBe(true);
  });

  it("拒绝无效日期、分类和倒置范围", () => {
    const result = parseHd1("HD1|20260230-1200|L|米饭~XX~CK~180-120g|BOIL|无");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("日期时间");
    expect(result.errors.join(" ")).toContain("分类代码");
  });

  it("拒绝零摄入和溢出为Infinity的数量", () => {
    expect(parseHd1("HD1|20260824-1200|L|米饭~GR~CK~0-0g|BOIL|无").ok).toBe(false);
    const huge = "9".repeat(400);
    expect(parseHd1(`HD1|20260824-1200|L|米饭~GR~CK~1-${huge}g|BOIL|无`).ok).toBe(false);
  });

  it("解析使用trim副本但保留真正的原始字符串", () => {
    const raw = "  HD1|20260824-1200|L|米饭~GR~CK~100-100g|BOIL|无  \n";
    const result = parseHd1(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rawImportLine).toBe(raw);
  });

  it("编辑校验拒绝空时间和无效数量", () => {
    const result = parseHd1("HD1|20260824-1200|L|米饭~GR~CK~100-100g|BOIL|无");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.value.eatenAt = ":00";
    result.value.items[0].quantityMax = 0;
    expect(validateMealDraft(result.value)).toHaveLength(2);
  });
});

