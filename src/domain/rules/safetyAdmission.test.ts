import { describe, expect, it } from "vitest";
import type { ActivityLevel, HealthFlag, UserProfile } from "./types";
import { calculateTargets } from "./targets";

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "default",
    birthDate: "1990-01-01",
    dietPattern: "OMNIVORE",
    heightCm: 175,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags: [],
    updatedAt: "2026-08-25T00:00:00",
    ...overrides
  };
}

describe("health mode admission", () => {
  it("完整普通成年人资料允许生成普通建议", () => {
    const targets = calculateTargets(profile());
    expect(targets.profileComplete).toBe(true);
    expect(targets.safetyRestricted).toBe(false);
  });

  it("缺少出生日期或饮食模式时暂停自动建议", () => {
    const targets = calculateTargets(profile({ birthDate: undefined, dietPattern: undefined }));
    expect(targets.profileComplete).toBe(false);
    expect(targets.missingProfileFields).toEqual(["出生日期", "饮食模式"]);
    expect(targets.safetyRestricted).toBe(true);
  });

  it("按生日而不是仅按出生年份判断18岁边界", () => {
    const today = new Date();
    const adultBirthday = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const minorBirthday = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate() + 1);

    expect(calculateTargets(profile({ birthDate: dateKey(adultBirthday) })).safetyMessages.join(" ")).not.toContain("未成年人");
    expect(calculateTargets(profile({ birthDate: dateKey(minorBirthday) })).safetyMessages.join(" ")).toContain("未成年人");
  });

  it.each<HealthFlag>(["ABNORMAL_TESTS", "PERSISTENT_SYMPTOMS", "MALNUTRITION", "EATING_DISORDER"])(
    "%s 触发安全门",
    (flag) => {
      expect(calculateTargets(profile({ healthFlags: [flag] })).safetyRestricted).toBe(true);
    }
  );
});

describe("protein cross-check status", () => {
  it.each<[ActivityLevel, "LOW" | "WITHIN" | "HIGH"]>([
    ["BEDRIDDEN", "LOW"],
    ["LIGHT", "WITHIN"],
    ["MODERATE", "HIGH"],
    ["HEAVY", "HIGH"]
  ])("%s 活动档为 %s", (activityLevel, expected) => {
    expect(calculateTargets(profile({ activityLevel })).proteinCrossCheckStatus).toBe(expected);
  });

  it("轻体力手动25系数时为偏低", () => {
    expect(calculateTargets(profile({ overweightAdjustmentEnabled: true })).proteinCrossCheckStatus).toBe("LOW");
  });
});
