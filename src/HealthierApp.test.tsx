import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssessmentPanel } from "./HealthierApp";
import { assessDay, calculateTargets, type UserProfile } from "./domain";

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
});
