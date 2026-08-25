import type { ConfirmedMeal, FoodCategory } from "../meals/types";
import type { NutrientRange, NutritionFacts } from "../nutrition/types";

export const ACTIVITY_LEVELS = ["BEDRIDDEN", "LIGHT", "MODERATE", "HEAVY"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export type HealthFlag = "DISEASE" | "MEDICATION" | "PREGNANT" | "MINOR" | "EATING_DISORDER";

export interface UserProfile {
  id: "default";
  name?: string;
  birthYear?: number;
  sex?: "F" | "M" | "UNSPECIFIED";
  heightCm: number;
  currentWeightKg: number;
  waistCm?: number;
  activityLevel: ActivityLevel;
  overweightAdjustmentEnabled: boolean;
  healthFlags: HealthFlag[];
  updatedAt: string;
}

export interface DailyTargets {
  ruleSetVersion: string;
  standardWeightKg: number;
  activityFactor: number;
  energyKcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  animalProteinG: number;
  plantProteinG: number;
  proteinCrossCheck: { min: number; max: number };
  breakfastEnergy: { min: number; max: number };
  foodGroups: {
    grain: { min: number; max: number };
    wholeGrain: { min: number; max: number };
    tuber: { min: number; max: number };
    vegetable: { min: number; max: number };
    fruit: { min: number; max: number };
    dairy: { min: number; max: number };
    animalFood: { min: number; max: number };
    water: { min: number; max: number };
  };
  safetyRestricted: boolean;
  safetyMessages: string[];
  sourceRuleIds: string[];
}

export interface MealWithFacts {
  meal: ConfirmedMeal;
  facts: NutritionFacts;
}

export interface RangeValue {
  min: number;
  max: number;
}

export interface FoodGroupTotals {
  grain: RangeValue;
  wholeGrain: RangeValue;
  tuber: RangeValue;
  vegetable: RangeValue;
  darkVegetable: RangeValue;
  fruit: RangeValue;
  dairy: RangeValue;
  animalFood: RangeValue;
  fish: RangeValue;
  meat: RangeValue;
  egg: RangeValue;
}

export interface DailyAssessment {
  date: string;
  completed: boolean;
  nutrition: NutrientRange;
  groups: FoodGroupTotals;
  breakfastScore?: RangeValue;
  lunchGroupsComplete?: boolean;
  foodVarietyCount: number;
  foodNames: string[];
  unknownNutritionCount: number;
  unknownOil: boolean;
  waterMl: number;
  warnings: string[];
  targets: DailyTargets;
  presentCategories: FoodCategory[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  detail: string;
  ruleIds: string[];
  kind: "SAFETY" | "NEXT_MEAL" | "WEEKLY";
}

export interface WeeklyAssessment {
  startDate: string;
  endDate: string;
  validDays: number;
  averageNutrition?: NutrientRange;
  breakfastPassDays: number;
  animalFoodTotal: RangeValue;
  uniqueFoodCount: number;
  latestWeightKg?: number;
  previousWeightKg?: number;
  weightChangeKg?: number;
  issues: string[];
}

