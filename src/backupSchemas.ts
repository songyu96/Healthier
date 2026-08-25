import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  FOOD_CATEGORIES,
  FOOD_STATES,
  MEAL_TYPES,
  QUANTITY_UNITS
} from "./domain";

const finiteNonNegative = z.number().finite().nonnegative();
const finitePositive = z.number().finite().positive();

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

const dateKeySchema = z.string().refine(isValidDateKey, "日期无效");
const dateTimeSchema = z.string().refine(
  (value) => isValidDateKey(value.slice(0, 10)) && Number.isFinite(Date.parse(value)),
  "日期时间无效"
);
const rangeSchema = z.object({ min: finiteNonNegative, max: finiteNonNegative }).strict()
  .refine((value) => value.min <= value.max, "范围下限不能大于上限");
const nutrientVectorSchema = z.object({
  kcal: finiteNonNegative,
  protein: finiteNonNegative,
  fat: finiteNonNegative,
  carb: finiteNonNegative,
  fiber: finiteNonNegative
}).strict();

const dailyTargetsSchema = z.object({
  ruleSetVersion: z.string().min(1),
  standardWeightKg: finitePositive,
  activityFactor: finitePositive,
  energyKcal: finitePositive,
  carbG: finiteNonNegative,
  proteinG: finiteNonNegative,
  fatG: finiteNonNegative,
  animalProteinG: finiteNonNegative,
  plantProteinG: finiteNonNegative,
  proteinCrossCheck: rangeSchema,
  breakfastEnergy: rangeSchema,
  foodGroups: z.object({
    grain: rangeSchema,
    wholeGrain: rangeSchema,
    tuber: rangeSchema,
    vegetable: rangeSchema,
    fruit: rangeSchema,
    dairy: rangeSchema,
    animalFood: rangeSchema,
    water: rangeSchema
  }).strict(),
  safetyRestricted: z.boolean(),
  safetyMessages: z.array(z.string()),
  sourceRuleIds: z.array(z.string())
}).strict();

const profileSchema = z.object({
  id: z.literal("default"),
  name: z.string().optional(),
  birthYear: z.number().int().min(1900).max(3000).optional(),
  sex: z.enum(["F", "M", "UNSPECIFIED"]).optional(),
  heightCm: z.number().finite().gt(105).max(250),
  currentWeightKg: finitePositive.max(500),
  waistCm: finitePositive.max(300).optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  overweightAdjustmentEnabled: z.boolean(),
  healthFlags: z.array(z.enum(["DISEASE", "MEDICATION", "PREGNANT", "MINOR", "EATING_DISORDER"])),
  updatedAt: dateTimeSchema
}).strict();

const bodyMetricSchema = z.object({
  id: z.string().min(1),
  measuredAt: dateTimeSchema,
  weightKg: finitePositive.max(500),
  waistCm: finitePositive.max(300).optional(),
  note: z.string().optional()
}).strict();

const mealSchema = z.object({
  id: z.string().min(1),
  protocolVersion: z.literal("HD1"),
  eatenAt: dateTimeSchema,
  date: dateKeySchema,
  mealType: z.enum(MEAL_TYPES),
  cookingMethod: z.string(),
  note: z.string(),
  rawImportLine: z.string(),
  unknownOil: z.boolean(),
  unknownSalt: z.boolean(),
  ruleSetVersion: z.string().min(1),
  targetSnapshot: dailyTargetsSchema.optional(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema
}).strict()
  .refine((meal) => meal.eatenAt.slice(0, 10) === meal.date, "餐食日期与进餐时间不一致")
  .refine((meal) => !meal.targetSnapshot || meal.targetSnapshot.ruleSetVersion === meal.ruleSetVersion, "目标快照版本与餐食规则版本不一致");

const mealItemSchema = z.object({
  id: z.string().min(1),
  mealId: z.string().min(1),
  tempId: z.string().min(1),
  name: z.string().trim().min(1),
  category: z.enum(FOOD_CATEGORIES),
  state: z.enum(FOOD_STATES),
  quantityMin: finiteNonNegative,
  quantityMax: finitePositive,
  unit: z.enum(QUANTITY_UNITS),
  canonicalFoodId: z.string().min(1).optional()
}).strict().refine((item) => item.quantityMin <= item.quantityMax, "食物数量范围倒置");

const foodOverrideSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  aliases: z.array(z.string()),
  category: z.enum(FOOD_CATEGORIES),
  compatibleStates: z.array(z.enum(FOOD_STATES)).min(1),
  basisUnit: z.enum(["g", "ml"]),
  nutrientsPer100: nutrientVectorSchema.optional(),
  gramsPerPiece: finitePositive.optional(),
  source: z.object({
    kind: z.enum(["USDA_FDC", "BOOK", "USER"]),
    ref: z.string().min(1),
    release: z.string().min(1)
  }).strict(),
  bookNote: z.string().optional(),
  updatedAt: dateTimeSchema
}).strict();

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown()
}).strict().superRefine((setting, context) => {
  if (!isJsonValue(setting.value)) {
    context.addIssue({ code: "custom", message: "设置值必须是可序列化JSON" });
  }
  if (setting.key.startsWith("dayComplete:") && typeof setting.value !== "boolean") {
    context.addIssue({ code: "custom", message: "完成日设置必须是布尔值" });
  }
  if (setting.key.startsWith("water:") && (
    typeof setting.value !== "number" || !Number.isFinite(setting.value) || setting.value < 0
  )) {
    context.addIssue({ code: "custom", message: "饮水设置必须是非负有限数值" });
  }
});

function reportDuplicates(
  values: string[],
  label: string,
  context: z.RefinementCtx
): void {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) context.addIssue({ code: "custom", message: `${label}重复：${value}` });
    seen.add(value);
  });
}

export const backupPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: dateTimeSchema,
  profiles: z.array(profileSchema).max(1),
  bodyMetrics: z.array(bodyMetricSchema),
  meals: z.array(mealSchema),
  mealItems: z.array(mealItemSchema),
  foodOverrides: z.array(foodOverrideSchema),
  settings: z.array(settingSchema)
}).strict().superRefine((payload, context) => {
  reportDuplicates(payload.bodyMetrics.map((item) => item.id), "身体指标ID", context);
  reportDuplicates(payload.meals.map((item) => item.id), "餐食ID", context);
  reportDuplicates(payload.mealItems.map((item) => item.id), "餐食项ID", context);
  reportDuplicates(payload.foodOverrides.map((item) => item.id), "食物覆盖ID", context);
  reportDuplicates(payload.settings.map((item) => item.key), "设置键", context);

  const mealIds = new Set(payload.meals.map((meal) => meal.id));
  payload.mealItems.forEach((item) => {
    if (!mealIds.has(item.mealId)) {
      context.addIssue({ code: "custom", message: `存在孤儿食物项：${item.id}` });
    }
    if (item.id !== `${item.mealId}:${item.tempId}`) {
      context.addIssue({ code: "custom", message: `食物项ID与餐食关系不一致：${item.id}` });
    }
  });
  payload.meals.forEach((meal) => {
    if (!payload.mealItems.some((item) => item.mealId === meal.id)) {
      context.addIssue({ code: "custom", message: `餐食没有食物项：${meal.id}` });
    }
  });
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;
