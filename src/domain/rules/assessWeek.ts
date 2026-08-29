import { NUTRIENT_KEYS } from "../nutrition/types";
import type { NutrientKey, NutrientRange } from "../nutrition/types";
import type { DailyAssessment, FoodGroupKey, RangeValue, WeeklyAssessment } from "./types";

function sumGroup(days: DailyAssessment[], key: FoodGroupKey): RangeValue {
  return days.reduce<RangeValue>(
    (total, day) => ({
      min: total.min + day.groups[key].min,
      max: total.max + day.groups[key].max
    }),
    { min: 0, max: 0 }
  );
}

function allComparable(days: DailyAssessment[], keys: FoodGroupKey[]): boolean {
  return days.every((day) => keys.every((key) => !day.incomparableGroups.includes(key)));
}

function weeklyRangeIssue(label: string, value: RangeValue, target: RangeValue): string | undefined {
  if (value.max < target.min) return `本周${label}明确低于书中${target.min}～${target.max}克目标。`;
  if (value.min > target.max) return `本周${label}明确高于书中${target.min}～${target.max}克目标。`;
  return undefined;
}

export function assessWeek(
  startDate: string,
  endDate: string,
  days: DailyAssessment[],
  bodyMetrics: { measuredAt: string; weightKg: number }[]
): WeeklyAssessment {
  const validDays = days.filter((day) => day.completed);
  const nutritionDays = validDays.filter(
    (day) => day.nutritionComplete && day.nutritionReliability !== "LOW"
  );
  const nutritionDaysByNutrient = Object.fromEntries(NUTRIENT_KEYS.map((key) => [
    key,
    validDays.filter((day) =>
      day.nutritionReliability !== "LOW" && (day.nutritionCoverage?.[key].complete ?? day.nutritionComplete)
    )
  ])) as Record<NutrientKey, DailyAssessment[]>;
  const nutritionValidDaysByNutrient = Object.fromEntries(NUTRIENT_KEYS.map((key) => [
    key,
    nutritionDaysByNutrient[key].length
  ])) as Record<NutrientKey, number>;
  let averageNutrition: NutrientRange | undefined;
  if (NUTRIENT_KEYS.some((key) => nutritionDaysByNutrient[key].length > 0)) {
    const average = (key: NutrientKey, bound: "min" | "max") => {
      const nutrientDays = nutritionDaysByNutrient[key];
      return nutrientDays.length === 0
        ? 0
        : nutrientDays.reduce((sum, day) => sum + day.nutrition[bound][key], 0) / nutrientDays.length;
    };
    averageNutrition = {
      min: {
        kcal: average("kcal", "min"), protein: average("protein", "min"),
        fat: average("fat", "min"), carb: average("carb", "min"), fiber: average("fiber", "min")
      },
      max: {
        kcal: average("kcal", "max"), protein: average("protein", "max"),
        fat: average("fat", "max"), carb: average("carb", "max"), fiber: average("fiber", "max")
      }
    };
  }

  const animalFoodTotal = sumGroup(validDays, "animalFood");
  const fishTotal = sumGroup(validDays, "fish");
  const meatTotal = sumGroup(validDays, "meat");
  const eggTotal = sumGroup(validDays, "egg");
  const incomparableAnimalGroups = (["fish", "meat", "egg"] as const).filter(
    (key) => validDays.some((day) => day.incomparableGroups.includes(key))
  );
  const foodNames = new Set(validDays.flatMap((day) => day.foodNames));
  const sortedMetrics = bodyMetrics
    .filter((metric) => {
      const date = metric.measuredAt.slice(0, 10);
      return date >= startDate && date <= endDate;
    })
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = sortedMetrics.at(-1);
  const previous = sortedMetrics.at(-2);
  const breakfastPassDays = validDays.filter((day) => (day.breakfastScore?.min ?? 0) > 60).length;
  const issues: string[] = [];

  if (validDays.length < 4) issues.push("本周完整记录不足4天，趋势结论仅供参考。 ");
  if (validDays.length >= 4 && Math.min(
    nutritionValidDaysByNutrient.kcal,
    nutritionValidDaysByNutrient.protein
  ) / validDays.length < 0.7) {
    issues.push("本周可靠营养覆盖不足70%（能量或蛋白质），各项平均仅使用该营养素完整日。 ");
  }

  if (validDays.length === 7) {
    if (allComparable(validDays, ["fish", "meat", "egg"])) {
      const animalIssues = [
        weeklyRangeIssue("鱼虾", fishTotal, { min: 280, max: 525 }),
        weeklyRangeIssue("畜禽肉", meatTotal, { min: 280, max: 525 }),
        weeklyRangeIssue("蛋类", eggTotal, { min: 280, max: 350 })
      ].filter((issue): issue is string => Boolean(issue));
      issues.push(...animalIssues);
    } else {
      issues.push("本周鱼肉蛋存在熟重或单位折算问题，不能与书中周目标直接比较。 ");
    }
  }

  const energyDays = nutritionDaysByNutrient.kcal;
  const proteinDays = nutritionDaysByNutrient.protein;
  if (energyDays.length >= 4) {
    const lowEnergyDays = energyDays.filter(
      (day) => day.nutrition.max.kcal < day.targets.energyKcal * 0.8
    ).length;
    if (lowEnergyDays >= Math.ceil(energyDays.length * 0.6)) {
      issues.push("多数能量已知上限仍低于目标80%的数据完整日。 ");
    }
  }
  if (proteinDays.length >= 4) {
    const lowProteinDays = proteinDays.filter(
      (day) => day.nutrition.max.protein < day.targets.proteinG * 0.8
    ).length;
    if (lowProteinDays >= Math.ceil(proteinDays.length * 0.6)) {
      issues.push("多数蛋白质已知上限仍低于目标80%的数据完整日。 ");
    }
  }

  const comparableDairyDays = validDays.filter((day) => !day.incomparableGroups.includes("dairy"));
  if (comparableDairyDays.length >= 4) {
    const lowDairyDays = comparableDairyDays.filter(
      (day) => day.groups.dairy.max < day.targets.foodGroups.dairy.min
    ).length;
    if (lowDairyDays >= Math.ceil(comparableDairyDays.length * 0.6)) {
      issues.push("多数可比较记录日的液态奶类低于书中目标。 ");
    }
  }

  if (foodNames.size < 25 && validDays.length >= 4) issues.push("本周明确达到5克的食材少于书中最低25种目标。 ");
  if (breakfastPassDays < Math.ceil(validDays.length / 2)) {
    issues.push("本周多数有效记录日的早餐未明确达到及格线。 ");
  }

  return {
    startDate,
    endDate,
    validDays: validDays.length,
    nutritionValidDays: nutritionDays.length,
    nutritionValidDaysByNutrient,
    averageNutrition,
    breakfastPassDays,
    animalFoodTotal,
    fishTotal,
    meatTotal,
    eggTotal,
    incomparableAnimalGroups,
    uniqueFoodCount: foodNames.size,
    latestWeightKg: latest?.weightKg,
    previousWeightKg: previous?.weightKg,
    weightChangeKg: latest && previous ? latest.weightKg - previous.weightKg : undefined,
    issues: issues.map((issue) => issue.trim())
  };
}
