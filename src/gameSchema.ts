import { z } from "zod";
import { goalVersionOn, type GameState } from "./game";

export function isGameDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[3]);
}

const gameDateSchema = z.string().refine(isGameDateKey, "日期无效");
const goalVersionSchema = z.object({
  effectiveOn: gameDateSchema,
  name: z.string().trim().min(1).max(50),
  category: z.enum(["FITNESS", "SPORT", "READING", "ART", "OTHER"]),
  weeklyFrequency: z.number().int().min(1).max(7),
  minimumMinutes: z.number().int().min(1).max(1440)
}).strict();

const goalSchema = z.object({
  id: z.string().uuid(),
  startedOn: gameDateSchema,
  archivedOn: gameDateSchema.optional(),
  versions: z.array(goalVersionSchema).min(1)
}).strict().superRefine((goal, context) => {
  if (goal.versions[0]?.effectiveOn !== goal.startedOn) {
    context.addIssue({ code: "custom", message: "目标首版本日期不一致" });
  }
  if (goal.archivedOn && goal.archivedOn < goal.startedOn) {
    context.addIssue({ code: "custom", message: "目标停用日期早于开始日期" });
  }
  goal.versions.forEach((version, index) => {
    if (index > 0 && version.effectiveOn <= goal.versions[index - 1].effectiveOn) {
      context.addIssue({ code: "custom", message: "目标版本日期必须严格递增" });
    }
  });
});

const checkinSchema = z.object({
  goalId: z.string().uuid(),
  date: gameDateSchema,
  minutes: z.number().int().min(1).max(1440)
}).strict();

export const gameStateSchema = z.object({
  startedOn: gameDateSchema,
  avatarStyle: z.enum(["FEMALE", "MALE"]).optional(),
  goals: z.array(goalSchema),
  checkins: z.array(checkinSchema),
  unlocks: z.array(z.enum(["FREESTYLE", "DOLPHIN", "BUTTERFLY"]))
}).strict().superRefine((state, context) => {
  const ids = new Set<string>();
  state.goals.forEach((goal) => {
    if (ids.has(goal.id)) context.addIssue({ code: "custom", message: "目标ID重复" });
    ids.add(goal.id);
    if (goal.startedOn < state.startedOn) context.addIssue({ code: "custom", message: "目标早于游戏开始" });
  });
  const checkinKeys = new Set<string>();
  state.checkins.forEach((checkin) => {
    const key = `${checkin.goalId}:${checkin.date}`;
    if (checkinKeys.has(key)) context.addIssue({ code: "custom", message: "同日目标打卡重复" });
    checkinKeys.add(key);
    const goal = state.goals.find((item) => item.id === checkin.goalId);
    if (!goal || checkin.date < state.startedOn || !goalVersionOn(goal, checkin.date)) {
      context.addIssue({ code: "custom", message: "打卡对应的目标或日期无效" });
    }
  });
  if (new Set(state.unlocks).size !== state.unlocks.length) {
    context.addIssue({ code: "custom", message: "解锁内容重复" });
  }
});

export function validateGameState(value: unknown): GameState {
  return gameStateSchema.parse(value);
}
