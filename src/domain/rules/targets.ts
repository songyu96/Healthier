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

function ageOnDate(birthDateText: string, today: Date): number | undefined {
  const birthDate = new Date(`${birthDateText}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return undefined;
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed = today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
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
  const missingProfileFields: string[] = [];
  if (!profile.birthDate) missingProfileFields.push("出生日期");
  if (!profile.dietPattern) missingProfileFields.push("饮食模式");
  if (missingProfileFields.length > 0) {
    safetyMessages.push(`健康模式资料不完整：缺少${missingProfileFields.join("、")}。`);
  }

  const today = new Date();
  const exactAge = profile.birthDate ? ageOnDate(profile.birthDate, today) : undefined;
  const isMinor = profile.healthFlags.includes("MINOR") ||
    (exactAge !== undefined
      ? exactAge < 18
      : profile.birthYear !== undefined && today.getFullYear() - profile.birthYear < 18);

  if (profile.birthDate && exactAge === undefined) safetyMessages.push("出生日期无效或晚于今天，无法启用普通成年人建议。 ");
  if (isMinor) safetyMessages.push("未成年人不适用本应用的普通成年人自动建议。 ");
  if (profile.healthFlags.includes("DISEASE")) safetyMessages.push("存在确诊疾病时，书中健康人公式不能作为治疗方案。 ");
  if (profile.healthFlags.includes("MEDICATION")) safetyMessages.push("正在用药时，饮食调整需要考虑药物和食物相互作用。 ");
  if (profile.healthFlags.includes("PREGNANT")) safetyMessages.push("孕产期属于特殊营养阶段，需要专业个体化评估。 ");
  if (profile.healthFlags.includes("EATING_DISORDER")) safetyMessages.push("存在进食障碍风险时，不提供能量限制和追赶式建议。 ");
  if (profile.healthFlags.includes("ABNORMAL_TESTS")) safetyMessages.push("存在重要异常检查或化验结果时，需要专业个体化评估。 ");
  if (profile.healthFlags.includes("PERSISTENT_SYMPTOMS")) safetyMessages.push("存在持续症状时，不根据普通健康人公式自动调整饮食。 ");
  if (profile.healthFlags.includes("MALNUTRITION")) safetyMessages.push("存在明显营养不良风险时，不提供能量限制或追赶式建议。 ");

  const proteinG = energyKcal * 0.15 / 4;
  const proteinCrossCheck = { min: standardWeightKg, max: standardWeightKg * 1.2 };
  const proteinCrossCheckStatus = proteinG < proteinCrossCheck.min
    ? "LOW"
    : proteinG > proteinCrossCheck.max ? "HIGH" : "WITHIN";

  return {
    ruleSetVersion: RULE_SET_VERSION,
    standardWeightKg,
    activityFactor,
    energyKcal,
    carbG: energyKcal * 0.55 / 4,
    proteinG,
    fatG: energyKcal * 0.30 / 9,
    animalProteinG: proteinG / 2,
    plantProteinG: proteinG / 2,
    proteinCrossCheck,
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
    profileComplete: missingProfileFields.length === 0,
    missingProfileFields,
    proteinCrossCheckStatus,
    sourceRuleIds: ["BR-E-001", "BR-E-002", "BR-E-003", "BR-M-001", "BR-M-002"]
  };
}
