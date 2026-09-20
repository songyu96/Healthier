import { describe, expect, it } from "vitest";
import type { DailyAssessment } from "./domain";
import {
  calculateGameSnapshot,
  evaluateDietDay,
  gameWeightDescription,
  goalVersionOn,
  nextWeekStart,
  type GameGoal,
  type GameState
} from "./game";

const GOAL_ID = "11111111-1111-4111-8111-111111111111";

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    startedOn: "2026-08-24",
    goals: [{
      id: GOAL_ID,
      startedOn: "2026-08-24",
      versions: [{
        effectiveOn: "2026-08-24",
        name: "读书",
        category: "READING",
        weeklyFrequency: 2,
        minimumMinutes: 30
      }]
    }],
    checkins: [],
    unlocks: [],
    ...overrides
  };
}

function day(date: string, options: {
  completed?: boolean;
  kcalComplete?: boolean;
  reliability?: DailyAssessment["nutritionReliability"];
  vegetable?: number;
  fruit?: number;
  variety?: number;
  incomparable?: DailyAssessment["incomparableGroups"];
  diversityEstimated?: boolean;
} = {}): DailyAssessment {
  return {
    date,
    completed: options.completed ?? true,
    nutritionCoverage: { kcal: { complete: options.kcalComplete ?? true } },
    nutritionReliability: options.reliability ?? "HIGH",
    groups: {
      vegetable: { min: options.vegetable ?? 300, max: options.vegetable ?? 300 },
      fruit: { min: options.fruit ?? 200, max: options.fruit ?? 200 }
    },
    foodVarietyCount: options.variety ?? 12,
    incomparableGroups: options.incomparable ?? [],
    diversityEstimated: options.diversityEstimated ?? false,
    targets: { foodGroups: { vegetable: { min: 300 }, fruit: { min: 200 } } }
  } as DailyAssessment;
}

describe("game weekly scoring", () => {
  it("目标每周两次各30分钟，15分钟加30分钟得到目标侧37.5分", () => {
    const game = state({ checkins: [
      { goalId: GOAL_ID, date: "2026-08-24", minutes: 15 },
      { goalId: GOAL_ID, date: "2026-08-27", minutes: 30 }
    ] });
    const week = calculateGameSnapshot(game, "2026-08-30", {}, "AVAILABLE").currentWeek;
    expect(week.goalPlannedSessions).toBe(2);
    expect(week.goalEarnedSessions).toBe(1.5);
    expect(week.goalRatio).toBe(0.75);
    expect(week.goalPoints).toBe(37.5);
  });

  it("饮食2天满分、1天半分，固定7天分母得到17.86分", () => {
    const assessments = {
      "2026-08-24": day("2026-08-24"),
      "2026-08-25": day("2026-08-25"),
      "2026-08-26": day("2026-08-26", { variety: 0, incomparable: ["vegetable"] }),
      "2026-08-27": day("2026-08-27", { completed: false }),
      "2026-08-28": day("2026-08-28", { kcalComplete: false }),
      "2026-08-29": day("2026-08-29", { vegetable: 0, fruit: 0, variety: 0 }),
      "2026-08-30": day("2026-08-30", { vegetable: 0, fruit: 0, variety: 0 })
    };
    const snapshot = calculateGameSnapshot(state(), "2026-08-30", assessments, "AVAILABLE");
    expect(snapshot.currentWeek.dietEarnedDays).toBe(2.5);
    expect(snapshot.currentWeek.dietPoints).toBeCloseTo(17.85714, 4);
    expect(snapshot.dietDays["2026-08-27"].status).toBe("UNASSESSED");
    expect(snapshot.dietDays["2026-08-29"]).toMatchObject({ status: "ASSESSED", score: 0 });
  });

  it("营养低可靠性或可评价指标不足时保持未评估", () => {
    expect(evaluateDietDay("2026-08-24", day("2026-08-24", { reliability: "LOW" }), "AVAILABLE").status).toBe("UNASSESSED");
    expect(evaluateDietDay("2026-08-24", day("2026-08-24", {
      incomparable: ["vegetable", "fruit"], diversityEstimated: true, variety: 3
    }), "AVAILABLE").status).toBe("UNASSESSED");
  });

  it("安全限制暂停饮食并让目标独占进度；无目标时饮食独占进度", () => {
    const game = state({ checkins: [{ goalId: GOAL_ID, date: "2026-08-24", minutes: 30 }] });
    const restricted = calculateGameSnapshot(game, "2026-08-30", { "2026-08-24": day("2026-08-24") }, "SAFETY_PAUSED");
    expect(restricted.currentWeek.goalPoints).toBe(50);
    expect(restricted.currentWeek.dietPoints).toBe(0);
    expect(restricted.dietDays["2026-08-24"].status).toBe("SAFETY_PAUSED");
    const dietOnly = calculateGameSnapshot(state({ goals: [] }), "2026-08-30", { "2026-08-24": day("2026-08-24") }, "AVAILABLE");
    expect(dietOnly.currentWeek.dietPoints).toBeCloseTo(100 / 7);
  });

  it("首个不完整周次数封顶，下一周按新版目标计算", () => {
    const goal: GameGoal = {
      id: GOAL_ID,
      startedOn: "2026-08-30",
      versions: [
        { effectiveOn: "2026-08-30", name: "练琴", category: "ART", weeklyFrequency: 5, minimumMinutes: 30 },
        { effectiveOn: "2026-08-31", name: "练琴", category: "ART", weeklyFrequency: 2, minimumMinutes: 20 }
      ]
    };
    expect(nextWeekStart("2026-08-30")).toBe("2026-08-31");
    expect(goalVersionOn(goal, "2026-08-30")?.minimumMinutes).toBe(30);
    expect(goalVersionOn(goal, "2026-08-31")?.minimumMinutes).toBe(20);
    const snapshot = calculateGameSnapshot(state({ startedOn: "2026-08-30", goals: [goal] }), "2026-09-06", {}, "AVAILABLE");
    expect(snapshot.weeks.map((week) => week.goalPlannedSessions)).toEqual([1, 2]);
  });

  it("周一完成一次后周二无操作，计划分母和里程保持稳定且不会提前解锁", () => {
    const game = state({
      goals: [{
        id: GOAL_ID,
        startedOn: "2026-08-24",
        versions: [{ effectiveOn: "2026-08-24", name: "读书", category: "READING", weeklyFrequency: 3, minimumMinutes: 30 }]
      }],
      checkins: [{ goalId: GOAL_ID, date: "2026-08-24", minutes: 30 }]
    });
    const monday = calculateGameSnapshot(game, "2026-08-24", {}, "SAFETY_PAUSED");
    const tuesday = calculateGameSnapshot(game, "2026-08-25", {}, "SAFETY_PAUSED");
    expect(monday.currentWeek.goalPlannedSessions).toBe(3);
    expect(tuesday.currentWeek.goalPlannedSessions).toBe(3);
    expect(monday.mileage).toBeCloseTo(100 / 3);
    expect(tuesday.mileage).toBeCloseTo(monday.mileage);
    expect(monday.newUnlocks).toEqual([]);
  });

  it("周中加入的目标按剩余整周天数固定分母，停用也不抬高当周分数", () => {
    const goal: GameGoal = {
      id: GOAL_ID,
      startedOn: "2026-08-26",
      archivedOn: "2026-08-28",
      versions: [{ effectiveOn: "2026-08-26", name: "练琴", category: "ART", weeklyFrequency: 7, minimumMinutes: 30 }]
    };
    const game = state({
      startedOn: "2026-08-26",
      goals: [goal],
      checkins: [{ goalId: GOAL_ID, date: "2026-08-26", minutes: 30 }]
    });
    const before = calculateGameSnapshot({ ...game, goals: [{ ...goal, archivedOn: undefined }] }, "2026-08-26", {}, "SAFETY_PAUSED");
    const after = calculateGameSnapshot(game, "2026-08-28", {}, "SAFETY_PAUSED");
    expect(before.currentWeek.goalPlannedSessions).toBe(5);
    expect(after.currentWeek.goalPlannedSessions).toBe(5);
    expect(after.mileage).toBeCloseTo(before.mileage);
  });

  it("页面计分说明覆盖各占一半、单侧100分和暂停", () => {
    expect(gameWeightDescription("AVAILABLE", true)).toContain("各占最高 50 分");
    expect(gameWeightDescription("AVAILABLE", false)).toContain("饮食结构最高 100 分");
    expect(gameWeightDescription("SAFETY_PAUSED", true)).toContain("个人目标最高 100 分");
    expect(gameWeightDescription("NO_PROFILE", false)).toContain("暂停计分");
  });

  it("历史重算可降低里程，但已解锁伙伴永久保留", () => {
    const withCheckins = state({
      checkins: [
        { goalId: GOAL_ID, date: "2026-08-24", minutes: 30 },
        { goalId: GOAL_ID, date: "2026-08-25", minutes: 30 }
      ]
    });
    const before = calculateGameSnapshot(withCheckins, "2026-08-30", {}, "SAFETY_PAUSED");
    expect(before.mileage).toBe(100);
    expect(before.newUnlocks).toContain("FREESTYLE");
    const after = calculateGameSnapshot({ ...withCheckins, checkins: [], unlocks: ["FREESTYLE"] }, "2026-08-30", {}, "SAFETY_PAUSED");
    expect(after.mileage).toBe(0);
    expect(after.unlocks).toContain("FREESTYLE");
    expect(after.newUnlocks).toEqual([]);
  });
});
