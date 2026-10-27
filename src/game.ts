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
  voyagePoints?: number;
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
  voyagePoints: number;
  unlocks: GameUnlockId[];
  newUnlocks: GameUnlockId[];
}

export type JourneyRegionId = "CORAL" | "MIST" | "STARS";
export type JourneySceneId = "CORAL" | "MIST" | "STARS" | "REST";
export type JourneyDestinationType = "START" | "MILESTONE" | "REST" | "REWARD" | "CHALLENGE" | "FINALE";

export interface JourneyDestination {
  id: string;
  region: JourneyRegionId;
  scene: JourneySceneId;
  threshold: number;
  name: string;
  description: string;
  type: JourneyDestinationType;
  x: number;
  y: number;
}

export const JOURNEY_REGIONS: Readonly<Record<JourneyRegionId, string>> = {
  CORAL: "珊瑚群岛",
  MIST: "云雾海",
  STARS: "星夜洋"
};

export const JOURNEY_DESTINATIONS: ReadonlyArray<JourneyDestination> = [
  { id: "DEPARTURE", region: "CORAL", scene: "CORAL", threshold: 0, name: "启航港", description: "从温暖海湾出发，让每天的记录成为航程。", type: "START", x: 9, y: 78 },
  { id: "DAWN_SHOAL", region: "CORAL", scene: "CORAL", threshold: 50, name: "晨光浅滩", description: "阳光穿过清澈浅海，第一段航程已经完成。", type: "MILESTONE", x: 22, y: 66 },
  { id: "REST_ISLAND", region: "CORAL", scene: "REST", threshold: 100, name: "栖息岛", description: "在安静海湾靠岸，回顾本周，也允许自己慢下来。", type: "REST", x: 34, y: 76 },
  { id: "DOLPHIN_BAY", region: "CORAL", scene: "CORAL", threshold: 150, name: "海豚湾", description: "海豚伙伴会在这里加入你的长期旅程。", type: "REWARD", x: 42, y: 58 },
  { id: "BUTTERFLY_LIGHTHOUSE", region: "CORAL", scene: "CORAL", threshold: 300, name: "蝶翼灯塔", description: "灯塔照亮通往云雾海的航道。", type: "REWARD", x: 31, y: 43 },
  { id: "RAIN_ISLAND", region: "MIST", scene: "MIST", threshold: 400, name: "雨林岛", description: "穿过瀑布与薄雾，进入更深的绿色海域。", type: "MILESTONE", x: 47, y: 33 },
  { id: "CRESCENT_REST", region: "MIST", scene: "REST", threshold: 500, name: "月牙驿岛", description: "月牙形港湾为长途航行留出喘息空间。", type: "REST", x: 58, y: 45 },
  { id: "STORM_EYE", region: "MIST", scene: "MIST", threshold: 600, name: "风暴眼", description: "稳定的日常，比一次冲刺更能穿过风暴。这里是航线场景，不附加额外任务或失败规则。", type: "CHALLENGE", x: 65, y: 29 },
  { id: "AURORA_PORT", region: "MIST", scene: "MIST", threshold: 700, name: "极光港", description: "云层散开，星夜洋已经出现在前方。", type: "MILESTONE", x: 72, y: 42 },
  { id: "GLOW_ISLAND", region: "STARS", scene: "STARS", threshold: 850, name: "浮光岛", description: "海面收集星光，新的岛屿在夜色中浮现。", type: "MILESTONE", x: 78, y: 60 },
  { id: "METEOR_REST", region: "STARS", scene: "REST", threshold: 1000, name: "流星驿站", description: "在流星划过时靠岸，不必每天都全速前进。", type: "REST", x: 87, y: 73 },
  { id: "WORLD_TREE", region: "STARS", scene: "STARS", threshold: 1100, name: "世界树海岸", description: "发光的树冠记录着一路积累的微小改变。", type: "MILESTONE", x: 91, y: 50 },
  { id: "STAR_BEACON", region: "STARS", scene: "STARS", threshold: 1200, name: "星潮灯塔", description: "第一季航程完成；之后的每一分仍会被继续珍藏。", type: "FINALE", x: 91, y: 19 }
];

export function journeyPosition(points: number): {
  current: JourneyDestination;
  next?: JourneyDestination;
  remaining: number;
  x: number;
  y: number;
} {
  const safePoints = Math.max(0, points);
  const current = [...JOURNEY_DESTINATIONS].reverse().find((destination) => safePoints >= destination.threshold)
    ?? JOURNEY_DESTINATIONS[0];
  const currentIndex = JOURNEY_DESTINATIONS.indexOf(current);
  const next = JOURNEY_DESTINATIONS[currentIndex + 1];
  if (!next) return { current, remaining: 0, x: current.x, y: current.y };
  const legProgress = Math.min(1, Math.max(0, (safePoints - current.threshold) / (next.threshold - current.threshold)));
  return {
    current,
    next,
    remaining: Math.max(0, next.threshold - safePoints),
    x: current.x + (next.x - current.x) * legProgress,
    y: current.y + (next.y - current.y) * legProgress
  };
}

export const GAME_UNLOCKS: ReadonlyArray<{ id: GameUnlockId; threshold: number; label: string; description: string }> = [
  { id: "FREESTYLE", threshold: 50, label: "晨光浅滩", description: "完成第一段航程，浅海图鉴永久点亮。" },
  { id: "DOLPHIN", threshold: 150, label: "海豚湾伙伴", description: "抵达海豚湾，海豚伙伴加入旅行图鉴。" },
  { id: "BUTTERFLY", threshold: 300, label: "蝶翼灯塔", description: "点亮珊瑚群岛尽头的灯塔，开启云雾海航线。" }
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
  const legacyUnlockPoints = GAME_UNLOCKS.reduce(
    (highest, unlock) => state.unlocks.includes(unlock.id) ? Math.max(highest, unlock.threshold) : highest,
    0
  );
  const voyagePoints = Math.max(state.voyagePoints ?? 0, mileage, legacyUnlockPoints);
  const newUnlocks = GAME_UNLOCKS.filter((unlock) => voyagePoints >= unlock.threshold && !state.unlocks.includes(unlock.id))
    .map((unlock) => unlock.id);
  return {
    weeks,
    currentWeek: weeks.at(-1)!,
    dietDays,
    mileage,
    voyagePoints,
    unlocks: [...state.unlocks, ...newUnlocks],
    newUnlocks
  };
}
