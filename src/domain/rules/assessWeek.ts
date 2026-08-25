import type { NutrientRange, NutrientVector } from "../nutrition/types";
import type { DailyAssessment, RangeValue, WeeklyAssessment } from "./types";

function addVector(left: NutrientVector, right: NutrientVector): NutrientVector {
  return {
    kcal: left.kcal + right.kcal,
    protein: left.protein + right.protein,
    fat: left.fat + right.fat,
    carb: left.carb + right.carb,
    fiber: left.fiber + right.fiber
  };
}

function divideVector(vector: NutrientVector, divisor: number): NutrientVector {
  return {
    kcal: vector.kcal / divisor,
    protein: vector.protein / divisor,
    fat: vector.fat / divisor,
    carb: vector.carb / divisor,
    fiber: vector.fiber / divisor
  };
}

export function assessWeek(
  startDate: string,
  endDate: string,
  days: DailyAssessment[],
  bodyMetrics: { measuredAt: string; weightKg: number }[]
): WeeklyAssessment {
  const validDays = days.filter((day) => day.completed);
  let averageNutrition: NutrientRange | undefined;
  if (validDays.length > 0) {
    const sum = validDays.reduce<NutrientRange>(
      (total, day) => ({
        min: addVector(total.min, day.nutrition.min),
        max: addVector(total.max, day.nutrition.max)
      }),
      {
        min: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 },
        max: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 }
      }
    );
    averageNutrition = {
      min: divideVector(sum.min, validDays.length),
      max: divideVector(sum.max, validDays.length)
    };
  }

  const animalFoodTotal = validDays.reduce<RangeValue>(
    (total, day) => ({
      min: total.min + day.groups.animalFood.min,
      max: total.max + day.groups.animalFood.max
    }),
    { min: 0, max: 0 }
  );
  const foodNames = new Set(validDays.flatMap((day) => day.foodNames));
  const sortedMetrics = [...bodyMetrics].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = sortedMetrics.at(-1);
  const previous = sortedMetrics.at(-2);
  const issues: string[] = [];

  if (validDays.length < 4) issues.push("本周完整记录不足4天，趋势结论仅供参考。 ");
  if (foodNames.size < 25 && validDays.length >= 4) issues.push("本周食物种类少于书中最低25种目标。 ");
  if (validDays.filter((day) => (day.breakfastScore?.min ?? 0) > 60).length < Math.ceil(validDays.length / 2)) {
    issues.push("本周多数有效记录日的早餐未明确达到及格线。 ");
  }

  return {
    startDate,
    endDate,
    validDays: validDays.length,
    averageNutrition,
    breakfastPassDays: validDays.filter((day) => (day.breakfastScore?.min ?? 0) > 60).length,
    animalFoodTotal,
    uniqueFoodCount: foodNames.size,
    latestWeightKg: latest?.weightKg,
    previousWeightKg: previous?.weightKg,
    weightChangeKg: latest && previous ? latest.weightKg - previous.weightKg : undefined,
    issues: issues.map((issue) => issue.trim())
  };
}

