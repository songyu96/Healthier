import type { DailyAssessment } from "./domain";

export type GameGoalCategory = "FITNESS" | "SPORT" | "READING" | "ART" | "OTHER";
export type GameUnlockId = "FREESTYLE" | "DOLPHIN" | "BUTTERFLY";
export type GameAvatarStyle = "FEMALE" | "MALE";

export interface GameGoalVersion {
  effectiveOn: string;
  name: string;
  category: GameGoalCategory;
  weeklyFrequency: number;
  minimumMinutes: number;
}

export interface GameGoal {
  id: string;
  startedOn: string;
  archivedOn?: string;
  versions: GameGoalVersion[];
}

export interface GameCheckin {
  goalId: string;
  date: string;
  minutes: number;
}

export interface GameState {
  startedOn: string;
  avatarStyle?: GameAvatarStyle;
  goals: GameGoal[];
  checkins: GameCheckin[];
  unlocks: GameUnlockId[];
}

export type DietMode = "AVAILABLE" | "SAFETY_PAUSED" | "NO_PROFILE";
export type DietDayStatus = "UNASSESSED" | "ASSESSED" | "SAFETY_PAUSED";

export interface GameDietDay {
  date: string;
  status: DietDayStatus;
  score: number;
  evaluableIndicators: number;
  passedIndicators: number;
}

export interface GameWeek {
  startedOn: string;
  endedOn: string;
  goalPlannedSessions: number;
  goalEarnedSessions: number;
  goalRatio: number;
  dietEarnedDays: number;
  dietRatio: number;
  goalPoints: number;
  dietPoints: number;
  points: number;
}

export interface GameSnapshot {
  weeks: GameWeek[];
  currentWeek: GameWeek;
  dietDays: Record<string, GameDietDay>;
  mileage: number;
  unlocks: GameUnlockId[];
  newUnlocks: GameUnlockId[];
}

export const GAME_UNLOCKS: ReadonlyArray<{ id: GameUnlockId; threshold: number; label: string }> = [
  { id: "FREESTYLE", threshold: 50, label: "自由泳" },
  { id: "DOLPHIN", threshold: 150, label: "海豚伙伴" },
  { id: "BUTTERFLY", threshold: 300, label: "蝶泳" }
];

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekStart(key: string): string {
  const date = dateFromKey(key);
  const offset = (date.getDay() + 6) % 7;
  return shiftDate(key, -offset);
}

export function nextWeekStart(key: string): string {
  return shiftDate(weekStart(key), 7);
}

export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

export function goalVersionOn(goal: GameGoal, date: string): GameGoalVersion | undefined {
  if (date < goal.startedOn || (goal.archivedOn && date >= goal.archivedOn)) return undefined;
  return [...goal.versions].reverse().find((version) => version.effectiveOn <= date);
}

export function evaluateDietDay(
  date: string,
  assessment: DailyAssessment | undefined,
  mode: DietMode
): GameDietDay {
  if (mode === "SAFETY_PAUSED") {
    return { date, status: "SAFETY_PAUSED", score: 0, evaluableIndicators: 0, passedIndicators: 0 };
  }
  if (mode === "NO_PROFILE" || !assessment?.completed ||
    !assessment.nutritionCoverage?.kcal.complete || assessment.nutritionReliability === "LOW") {
    return { date, status: "UNASSESSED", score: 0, evaluableIndicators: 0, passedIndicators: 0 };
  }

  const indicators: boolean[] = [];
  if (!assessment.incomparableGroups.includes("vegetable")) {
    indicators.push(assessment.groups.vegetable.min >= assessment.targets.foodGroups.vegetable.min);
  }
  if (!assessment.incomparableGroups.includes("fruit")) {
    indicators.push(assessment.groups.fruit.min >= assessment.targets.foodGroups.fruit.min);
  }
  if (!assessment.diversityEstimated || assessment.foodVarietyCount >= 12) {
    indicators.push(assessment.foodVarietyCount >= 12);
  }
  if (indicators.length < 2) {
    return { date, status: "UNASSESSED", score: 0, evaluableIndicators: indicators.length, passedIndicators: 0 };
  }
  const passedIndicators = indicators.filter(Boolean).length;
  return {
    date,
    status: "ASSESSED",
    score: passedIndicators / indicators.length,
    evaluableIndicators: indicators.length,
    passedIndicators
  };
}

export function gameWeightDescription(mode: DietMode, hasGoal: boolean): string {
  if (mode === "SAFETY_PAUSED") {
    return hasGoal ? "饮食暂不参与评价，本周个人目标最高 100 分。" : "饮食暂不参与评价，本周没有有效目标，暂停计分。";
  }
  if (mode === "NO_PROFILE") {
    return hasGoal ? "饮食未评估，本周个人目标最高 100 分。" : "饮食未评估，本周没有有效目标，暂停计分。";
  }
  return hasGoal ? "本周饮食结构与个人目标各占最高 50 分。" : "本周没有有效目标，饮食结构最高 100 分。";
}

function goalWeekProgress(state: GameState, start: string, weekEnd: string, throughDate: string): { planned: number; earned: number } {
  let planned = 0;
  let earned = 0;
  for (const goal of state.goals) {
    const firstDate = goal.startedOn > start ? goal.startedOn : start;
    if (firstDate > weekEnd) continue;
    const version = goalVersionOn(goal, firstDate);
    if (!version) continue;
    // The quota uses the whole remaining week, so merely advancing the clock cannot reduce earned points.
    // Archiving preserves this week's original quota; check-ins stop on the archive date.
    const quota = Math.min(version.weeklyFrequency, datesBetween(firstDate, weekEnd).length);
    planned += quota;
    const scores = state.checkins
      .filter((checkin) => checkin.goalId === goal.id && checkin.date >= firstDate && checkin.date <= throughDate && goalVersionOn(goal, checkin.date))
      .map((checkin) => Math.min(1, checkin.minutes / (goalVersionOn(goal, checkin.date)?.minimumMinutes ?? version.minimumMinutes)))
      .sort((left, right) => right - left);
    earned += scores.slice(0, quota).reduce((sum, score) => sum + score, 0);
  }
  return { planned, earned };
}

export function calculateGameSnapshot(
  state: GameState,
  today: string,
  assessments: Record<string, DailyAssessment>,
  dietMode: DietMode
): GameSnapshot {
  const dietDays: Record<string, GameDietDay> = {};
  const weeks: GameWeek[] = [];
  const currentWeekStart = weekStart(today);
  for (let start = weekStart(state.startedOn); start <= currentWeekStart; start = shiftDate(start, 7)) {
    const end = shiftDate(start, 6);
    const activeStart = start < state.startedOn ? state.startedOn : start;
    const activeEnd = end > today ? today : end;
    const goal = goalWeekProgress(state, activeStart, end, activeEnd);
    let dietEarnedDays = 0;
    for (const date of datesBetween(activeStart, activeEnd)) {
      const day = evaluateDietDay(date, assessments[date], dietMode);
      dietDays[date] = day;
      dietEarnedDays += day.score;
    }
    const goalRatio = goal.planned > 0 ? goal.earned / goal.planned : 0;
    const dietRatio = dietEarnedDays / 7;
    const dietAvailable = dietMode === "AVAILABLE";
    const goalAvailable = goal.planned > 0;
    const goalWeight = goalAvailable ? (dietAvailable ? 50 : 100) : 0;
    const dietWeight = dietAvailable ? (goalAvailable ? 50 : 100) : 0;
    const goalPoints = goalRatio * goalWeight;
    const dietPoints = dietRatio * dietWeight;
    weeks.push({
      startedOn: start,
      endedOn: end,
      goalPlannedSessions: goal.planned,
      goalEarnedSessions: goal.earned,
      goalRatio,
      dietEarnedDays,
      dietRatio,
      goalPoints,
      dietPoints,
      points: goalPoints + dietPoints
    });
  }
  const mileage = weeks.reduce((sum, week) => sum + week.points, 0);
  const newUnlocks = GAME_UNLOCKS.filter((unlock) => mileage >= unlock.threshold && !state.unlocks.includes(unlock.id))
    .map((unlock) => unlock.id);
  return {
    weeks,
    currentWeek: weeks.at(-1)!,
    dietDays,
    mileage,
    unlocks: [...state.unlocks, ...newUnlocks],
    newUnlocks
  };
}
