import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssessmentPanel, MealRow, WeeklyActionsPanel } from "./HealthierApp";
import { assessDay, assessWeek, calculateTargets, type ConfirmedMeal, type UserProfile } from "./domain";

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
