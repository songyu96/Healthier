import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  AssessmentPanel,
  BookChapterCard,
  BrandMark,
  MealRow,
  QuickMealCard,
  WeeklyActionsPanel,
  commonPortions,
  filterFoodsForMealEditor,
  foodCategoriesForKind,
  foodQualityLabel
} from "./HealthierApp";
import {
  assessDay,
  assessWeek,
  appendQuickMealFood,
  BOOK_CHAPTERS,
  calculateTargets,
  createQuickMealDraft,
  type ConfirmedMeal,
  type FoodReference,
  type UserProfile
} from "./domain";

function profile(healthFlags: UserProfile["healthFlags"]): UserProfile {
  return {
    id: "default",
    birthDate: "1990-01-01",
    dietPattern: "OMNIVORE",
    dailyExercise: "NONE",
    dietHabitSummary: "三餐规律",
    heightCm: 175,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags,
    updatedAt: "2026-08-25T08:00:00.000Z"
  };
}

describe("brand mark", () => {
  it("使用 H 与叶片图形，不再显示旧汉字标志", () => {
    const html = renderToStaticMarkup(<BrandMark />);

    expect(html).toContain("<svg");
    expect(html).toContain("brand-leaf");
    expect(html).not.toContain("衡");
  });
});

describe("book knowledge rendering", () => {
  it("目录卡只展示主题入口，不重复详情与审计信息", () => {
    const chapter = BOOK_CHAPTERS.find((item) => item.id === "B1-BREAKFAST");
    expect(chapter).toBeDefined();
    const html = renderToStaticMarkup(
      <MemoryRouter><BookChapterCard chapter={chapter!} /></MemoryRouter>
    );

    expect(html).toContain("早餐一定要吃够100分");
    expect(html).toContain("/book/B1-BREAKFAST");
    expect(html).not.toContain("第一册");
    expect(html).not.toContain("PART 03");
    expect(html).not.toContain(chapter!.coreIdea);
    expect(html).not.toContain("EPUB目录");
    expect(html).not.toContain("BR-B-002");
  });
});

describe("AssessmentPanel safety rendering", () => {
  it("安全门开启时只展示摄入事实和安全提示", () => {
    const targets = calculateTargets(profile(["MEDICATION"]));
    const assessment = assessDay(
      "2026-08-25",
      [],
      targets,
      { completed: false, waterMl: 0 }
    );
    const html = renderToStaticMarkup(<AssessmentPanel assessment={assessment} />);

    expect(html).toContain("今日摄入区间");
    expect(html).toContain("正在用药");
    expect(html).not.toContain(`目标 ${targets.energyKcal.toFixed(0)} kcal`);
    expect(html).not.toContain("结构检查");
    expect(html).not.toContain("下一餐先补");
  });

  it("安全门开启时周报隐藏目标判断和下周行动", () => {
    const targets = calculateTargets(profile(["MEDICATION"]));
    const week = assessWeek("2026-08-19", "2026-08-25", [], []);
    const html = renderToStaticMarkup(
      <WeeklyActionsPanel week={week} targets={targets} />
    );

    expect(html).toContain("普通建议已暂停");
    expect(html).toContain("只展示历史摄入事实");
    expect(html).toContain("正在用药");
    expect(html).not.toContain("下周行动");
    expect(html).not.toContain("完整记录不足");
  });

  it("迁移餐食展示升级时估算标记和局限说明", () => {
    const meal: ConfirmedMeal = {
      id: "migrated-meal",
      protocolVersion: "HD1",
      eatenAt: "2026-08-25T08:00:00",
      date: "2026-08-25",
      mealType: "B",
      items: [{
        tempId: "egg", name: "鸡蛋", category: "EG", state: "CK",
        quantityMin: 1, quantityMax: 1, unit: "pc"
      }],
      cookingMethod: "BOIL",
      note: "",
      rawImportLine: "test",
      unknownOil: false,
      unknownSalt: false,
      ruleSetVersion: "book-rules-0.1",
      nutritionSnapshotOrigin: "MIGRATED",
      createdAt: "2026-08-25T08:01:00",
      updatedAt: "2026-08-25T08:01:00"
    };
    const html = renderToStaticMarkup(
      <MealRow meal={meal} onEdit={() => undefined} onDelete={() => undefined} />
    );

    expect(html).toContain("升级时估算");
    expect(html).toContain("旧备份恢复当时的食物库");
  });

  it("仅在提供重复记录操作时展示再记一次按钮", () => {
    const meal: ConfirmedMeal = {
      id: "meal-1",
      protocolVersion: "HD1",
      eatenAt: "2026-08-25T08:00:00",
      date: "2026-08-25",
      mealType: "B",
      items: [{
        tempId: "egg", name: "鸡蛋", category: "EG", state: "CK",
        quantityMin: 1, quantityMax: 1, unit: "pc"
      }],
      cookingMethod: "水煮",
      note: "",
      rawImportLine: "test",
      unknownOil: false,
      unknownSalt: false,
      ruleSetVersion: "book-rules-0.1",
      createdAt: "2026-08-25T08:01:00",
      updatedAt: "2026-08-25T08:01:00"
    };

    const todayHtml = renderToStaticMarkup(
      <MealRow meal={meal} onRepeat={() => undefined} onEdit={() => undefined} onDelete={() => undefined} />
    );
    const historyHtml = renderToStaticMarkup(
      <MealRow meal={meal} onEdit={() => undefined} onDelete={() => undefined} />
    );

    expect(todayHtml).toContain("再记一次");
    expect(historyHtml).not.toContain("再记一次");
  });
});

describe("food library filters", () => {
  const food = (
    id: string,
    category: FoodReference["category"],
    foodKind?: FoodReference["foodKind"]
  ): FoodReference => ({
    id,
    name: id,
    aliases: [],
    category,
    compatibleStates: ["EA"],
    basisUnit: "g",
    foodKind,
    source: { kind: "USER", ref: "test", release: "test" }
  });

  const foods = [
    food("rice", "GR"),
    food("dumpling", "OT", "COMPOSITE"),
    food("burger", "UP", "COMPOSITE"),
    food("yogurt", "DA", "PACKAGED"),
    food("cola", "SD", "PACKAGED"),
    food("chips", "UP", "PACKAGED")
  ];

  it("只返回当前食物类型实际包含的分类", () => {
    expect(foodCategoriesForKind(foods, "INGREDIENT")).toEqual(["GR"]);
    expect(foodCategoriesForKind(foods, "COMPOSITE")).toEqual(["UP", "OT"]);
    expect(foodCategoriesForKind(foods, "PACKAGED")).toEqual(["DA", "SD", "UP"]);
  });

  it("全部类型返回食物库实际存在的分类", () => {
    expect(foodCategoriesForKind(foods, "ALL")).toEqual(["GR", "DA", "SD", "UP", "OT"]);
  });

  it("旧版USDA数据和配方估值显示正确质量标签", () => {
    const official = { ...food("official", "GR"), source: { kind: "USDA_FDC" as const, ref: "SR28", release: "2015" } };
    const estimate = {
      ...food("estimate", "GR", "INGREDIENT"),
      nutrientsPer100: { kcal: 200, protein: 5, fat: 2, carb: 40, fiber: 2 },
      recipeEstimate: { finalWeightG: 100, ingredients: [{ name: "面粉", weightG: 60 }], confidence: "LOW" as const },
      source: { kind: "REFERENCE" as const, ref: "RECIPE:estimate", release: "v1", method: "RECIPE" as const }
    };
    const partial = {
      ...food("partial", "FI"),
      partialNutrientsPer100: { kcal: 100, protein: 18, fat: 2 }
    };

    expect(foodQualityLabel(official)).toBe("官方通用数据");
    expect(foodQualityLabel(estimate)).toBe("低置信度估算");
    expect(foodQualityLabel(partial)).toBe("部分营养可计算");
  });

  it("餐食确认可按名称、别名和标签跨分类搜索", () => {
    const searchable = [
      { ...food("rice", "GR"), name: "熟米饭", aliases: ["白米饭"], tags: ["主食"] },
      { ...food("burger", "UP", "COMPOSITE"), name: "普通汉堡", aliases: ["牛肉汉堡"], tags: ["快餐"] },
      { ...food("milk", "DA"), name: "纯牛奶", aliases: [], tags: ["早餐"] }
    ];

    expect(filterFoodsForMealEditor(searchable, "牛肉").map((item) => item.id)).toEqual(["burger"]);
    expect(filterFoodsForMealEditor(searchable, "快餐").map((item) => item.id)).toEqual(["burger"]);
    expect(filterFoodsForMealEditor(searchable, "早餐").map((item) => item.id)).toEqual(["milk"]);
    expect(filterFoodsForMealEditor(searchable, "", "burger")[0]?.id).toBe("burger");
  });

  it("快速记餐清楚展示同一餐中的多项食物", () => {
    const rice = { ...food("rice", "GR"), name: "熟米饭" };
    const milk = { ...food("milk", "DA"), name: "纯牛奶", basisUnit: "ml" as const };
    const draft = appendQuickMealFood(
      createQuickMealDraft(rice, "2026-08-30T12:00:00", "L", true, true),
      milk
    );
    const html = renderToStaticMarkup(
      <QuickMealCard
        foods={[rice, milk]}
        favoriteFoodIds={["rice"]}
        favoriteFoods={[rice]}
        recentFoods={[milk]}
        draft={draft}
        onAdd={() => undefined}
        onToggleFavorite={() => undefined}
        onRemoveDraftItem={() => undefined}
        onClearDraft={() => undefined}
        onReviewDraft={() => undefined}
      />
    );

    expect(html).toContain("把这一餐逐项加进来");
    expect(html).toContain("本餐已选 2 项");
    expect(html).toContain("★ 熟米饭");
    expect(html).toContain("纯牛奶");
    expect(html).toContain("100g");
    expect(html).toContain("250ml");
    expect(html).toContain("移除熟米饭");
    expect(html).toContain("核对 2 项并保存");
    expect(html).not.toContain("餐次<select");
  });

  it("按单位提供简洁的常用份量", () => {
    expect(commonPortions("g")).toEqual([50, 100, 200]);
    expect(commonPortions("ml")).toEqual([250, 500]);
    expect(commonPortions("pc")).toEqual([1, 2]);
  });

  it("所有内置无营养占位均不进入普通选择，但旧记录和用户自建条目仍可用", () => {
    const builtInFallbacks: FoodReference[] = [
      {
        ...food("hotpot-unknown", "OT", "COMPOSITE"),
        name: "火锅（配料未知）",
        aliases: ["火锅"],
        source: { kind: "REFERENCE", ref: "test", release: "test" }
      },
      {
        ...food("juice-unknown", "SD", "PACKAGED"),
        name: "果汁饮料（品牌未知）",
        aliases: ["果汁饮料"],
        source: { kind: "REFERENCE", ref: "test", release: "test" }
      }
    ];
    const userFallback = {
      ...food("user-local", "OT"),
      name: "我的临时记录"
    };

    expect(filterFoodsForMealEditor([...builtInFallbacks, userFallback], "").map((item) => item.id))
      .toEqual(["user-local"]);
    expect(filterFoodsForMealEditor(builtInFallbacks, "果汁饮料")).toEqual([]);
    expect(filterFoodsForMealEditor(builtInFallbacks, "", "hotpot-unknown"))
      .toEqual([builtInFallbacks[0]]);
  });
});
