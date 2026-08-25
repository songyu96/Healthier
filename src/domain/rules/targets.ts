import type { ConfirmedMeal } from "../meals/types";
import type { ActivityLevel, DailyTargets, UserProfile } from "./types";

export const RULE_SET_VERSION = "book-rules-0.1";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  BEDRIDDEN: 25,
  LIGHT: 30,
  MODERATE: 35,
  HEAVY: 40
};

export function isDailyTargets(value: unknown): value is DailyTargets {
  if (!value || typeof value !== "object") return false;
  const targets = value as Partial<DailyTargets>;
  return typeof targets.ruleSetVersion === "string" &&
    typeof targets.energyKcal === "number" && Number.isFinite(targets.energyKcal) &&
    typeof targets.proteinG === "number" && Number.isFinite(targets.proteinG) &&
    typeof targets.safetyRestricted === "boolean" &&
    Array.isArray(targets.sourceRuleIds) && Boolean(targets.foodGroups);
}

export function resolveDailyTargets(
  meals: Pick<ConfirmedMeal, "targetSnapshot">[],
  storedDayTarget: unknown,
  fallback: DailyTargets
): DailyTargets {
  if (isDailyTargets(storedDayTarget)) return storedDayTarget;
  const mealTarget = meals.find((meal) => isDailyTargets(meal.targetSnapshot))?.targetSnapshot;
  return isDailyTargets(mealTarget) ? mealTarget : fallback;
}

export function calculateTargets(profile: UserProfile): DailyTargets {
  if (!Number.isFinite(profile.heightCm) || profile.heightCm <= 105 || profile.heightCm > 250) {
    throw new RangeError("身高必须在105～250厘米之间。 ");
  }

  const standardWeightKg = profile.heightCm - 105;
  const useOverweightAdjustment =
    profile.activityLevel === "LIGHT" && profile.overweightAdjustmentEnabled;
  const activityFactor = useOverweightAdjustment ? 25 : ACTIVITY_FACTORS[profile.activityLevel];
  const energyKcal = standardWeightKg * activityFactor;
  const safetyMessages: string[] = [];
  const currentYear = new Date().getFullYear();
  const isMinor = profile.healthFlags.includes("MINOR") ||
    (profile.birthYear !== undefined && currentYear - profile.birthYear < 18);

  if (isMinor) safetyMessages.push("未成年人不适用本应用的普通成年人自动建议。 ");
  if (profile.healthFlags.includes("DISEASE")) safetyMessages.push("存在确诊疾病时，书中健康人公式不能作为治疗方案。 ");
  if (profile.healthFlags.includes("MEDICATION")) safetyMessages.push("正在用药时，饮食调整需要考虑药物和食物相互作用。 ");
  if (profile.healthFlags.includes("PREGNANT")) safetyMessages.push("孕产期属于特殊营养阶段，需要专业个体化评估。 ");
  if (profile.healthFlags.includes("EATING_DISORDER")) safetyMessages.push("存在进食障碍风险时，不提供能量限制和追赶式建议。 ");

  return {
    ruleSetVersion: RULE_SET_VERSION,
    standardWeightKg,
    activityFactor,
    energyKcal,
    carbG: energyKcal * 0.55 / 4,
    proteinG: energyKcal * 0.15 / 4,
    fatG: energyKcal * 0.30 / 9,
    animalProteinG: energyKcal * 0.15 / 4 / 2,
    plantProteinG: energyKcal * 0.15 / 4 / 2,
    proteinCrossCheck: { min: standardWeightKg, max: standardWeightKg * 1.2 },
    breakfastEnergy: { min: energyKcal / 3, max: energyKcal / 2 },
    foodGroups: {
      grain: { min: 250, max: 400 },
      wholeGrain: { min: 50, max: 150 },
      tuber: { min: 50, max: 100 },
      vegetable: { min: 300, max: 500 },
      fruit: { min: 200, max: 350 },
      dairy: { min: 300, max: 300 },
      animalFood: { min: 120, max: 200 },
      water: { min: 1200, max: 1500 }
    },
    safetyRestricted: safetyMessages.length > 0,
    safetyMessages: safetyMessages.map((message) => message.trim()),
    sourceRuleIds: ["BR-E-001", "BR-E-002", "BR-E-003", "BR-M-001", "BR-M-002"]
  };
}

