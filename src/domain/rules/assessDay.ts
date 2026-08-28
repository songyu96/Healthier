import type { FoodCategory, MealItemInput } from "../meals/types";
import type { ItemNutritionFact, NutrientRange, NutrientVector } from "../nutrition/types";
import { resolveNutritionReliability } from "../nutrition/calculateNutrition";
import type {
  DailyAssessment,
  DailyTargets,
  FoodGroupKey,
  FoodGroupTotals,
  MealWithFacts,
  RangeValue
} from "./types";

const ZERO_RANGE = (): RangeValue => ({ min: 0, max: 0 });
const ZERO_NUTRIENTS = (): NutrientVector => ({ kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 });

const GROUP_KEYS_BY_CATEGORY: Partial<Record<FoodCategory, FoodGroupKey[]>> = {
  GR: ["grain"],
  WG: ["grain", "wholeGrain"],
  TU: ["grain", "tuber"],
  DV: ["vegetable", "darkVegetable"],
  LV: ["vegetable"],
  FR: ["fruit"],
  DA: ["dairy"],
  FI: ["animalFood", "fish"],
  MP: ["animalFood", "meat"],
  EG: ["animalFood", "egg"]
};

function addNutrients(left: NutrientVector, right: NutrientVector): NutrientVector {
  return {
    kcal: left.kcal + right.kcal,
    protein: left.protein + right.protein,
    fat: left.fat + right.fat,
    carb: left.carb + right.carb,
    fiber: left.fiber + right.fiber
  };
}

function addRange(target: RangeValue, min: number, max: number): void {
  target.min += min;
  target.max += max;
}

function groupTargets(): FoodGroupTotals {
  return {
    grain: ZERO_RANGE(),
    wholeGrain: ZERO_RANGE(),
    tuber: ZERO_RANGE(),
    vegetable: ZERO_RANGE(),
    darkVegetable: ZERO_RANGE(),
    fruit: ZERO_RANGE(),
    dairy: ZERO_RANGE(),
    animalFood: ZERO_RANGE(),
    fish: ZERO_RANGE(),
    meat: ZERO_RANGE(),
    egg: ZERO_RANGE()
  };
}

function groupKeys(category: FoodCategory): FoodGroupKey[] {
  return GROUP_KEYS_BY_CATEGORY[category] ?? [];
}

function addGroup(groups: FoodGroupTotals, category: FoodCategory, min: number, max: number): void {
  groupKeys(category).forEach((key) => addRange(groups[key], min, max));
}

function isComparableGroupQuantity(item: MealItemInput, fact: ItemNutritionFact): boolean {
  if (item.category === "DA") {
    return item.unit === "ml" && fact.basisUnit === "ml" && ["EA", "PK"].includes(item.state);
  }
  if (item.category === "EG") {
    return fact.basisUnit === "g" && ["g", "pc"].includes(item.unit) && ["RW", "CK", "EA"].includes(item.state);
  }
  if (item.category === "FR") {
    return item.unit === "g" && fact.basisUnit === "g" && ["RW", "EA"].includes(item.state);
  }
  return item.unit === "g" && fact.basisUnit === "g" && item.state === "RW";
}

const INGREDIENT_KEY_BY_FOOD_ID: Record<string, string> = {
  "bread-whole-wheat": "ingredient:wheat",
  "egg-noodles-cooked": "ingredient:wheat"
};

function diversityKey(item: MealItemInput, fact?: ItemNutritionFact): string {
  const foodId = fact?.foodId ?? item.canonicalFoodId;
  if (foodId) return INGREDIENT_KEY_BY_FOOD_ID[foodId] ?? foodId;
  return `name:${item.name.trim().toLocaleLowerCase("zh-CN")}`;
}

function diversityQuantity(item: MealItemInput, fact?: ItemNutritionFact): RangeValue | undefined {
  if (fact) return { min: fact.basisQuantityMin, max: fact.basisQuantityMax };
  if (item.unit === "g" || item.unit === "ml") {
    return { min: item.quantityMin, max: item.quantityMax };
  }
  return undefined;
}

function breakfastStructureCategories(categories: Set<FoodCategory>): number {
  const groups = [
    ["GR", "WG", "TU"],
    ["FI", "MP", "EG", "DA"],
    ["DV", "LV"],
    ["FR"],
    ["NS", "OI"]
  ];
  return groups.filter((group) => group.some((category) => categories.has(category as FoodCategory))).length;
}

export function assessDay(
  date: string,
  mealFacts: MealWithFacts[],
  targets: DailyTargets,
  options: { completed: boolean; waterMl: number }
): DailyAssessment {
  const nutrition = mealFacts.reduce<NutrientRange>(
    (sum, current) => ({
      min: addNutrients(sum.min, current.facts.totals.min),
      max: addNutrients(sum.max, current.facts.totals.max)
    }),
    { min: ZERO_NUTRIENTS(), max: ZERO_NUTRIENTS() }
  );
  const groups = groupTargets();
  const categories = new Set<FoodCategory>();
  const foodNames = new Set<string>();
  const incomparableGroups = new Set<FoodGroupKey>();
  let diversityEstimated = false;

  mealFacts.forEach(({ meal, facts }) => {
    const factsByTempId = new Map(facts.items.map((item) => [item.tempId, item]));
    meal.items.forEach((item) => {
      categories.add(item.category);
      const fact = factsByTempId.get(item.tempId);
      const itemGroupKeys = groupKeys(item.category);
      if (itemGroupKeys.length > 0) {
        if (fact && isComparableGroupQuantity(item, fact)) {
          addGroup(groups, fact.category, fact.basisQuantityMin, fact.basisQuantityMax);
        } else {
          itemGroupKeys.forEach((key) => incomparableGroups.add(key));
        }
      }

      if (!["OI", "OT"].includes(item.category)) {
        const quantity = diversityQuantity(item, fact);
        if (quantity?.min !== undefined && quantity.min >= 5) {
          foodNames.add(diversityKey(item, fact));
        } else if (!quantity || quantity.max >= 5) {
          diversityEstimated = true;
        }
      }
    });
  });

  const breakfastFacts = mealFacts.filter(({ meal }) => meal.mealType === "B");
  let breakfastScore: RangeValue | undefined;
  if (breakfastFacts.length > 0) {
    const breakfastEnergy = breakfastFacts.reduce(
      (sum, current) => ({
        min: sum.min + current.facts.totals.min.kcal,
        max: sum.max + current.facts.totals.max.kcal
      }),
      ZERO_RANGE()
    );
    const breakfastCategories = new Set(
      breakfastFacts.flatMap(({ meal }) => meal.items.map((item) => item.category))
    );
    const structureScore = breakfastStructureCategories(breakfastCategories) * 10;
    const energyBase = targets.energyKcal / 3;
    breakfastScore = {
      min: Math.min(50, 50 * breakfastEnergy.min / energyBase) + structureScore,
      max: Math.min(50, 50 * breakfastEnergy.max / energyBase) + structureScore
    };
  }

  const lunchCategories = new Set(
    mealFacts
      .filter(({ meal }) => meal.mealType === "L")
      .flatMap(({ meal }) => meal.items.map((item) => item.category))
  );
  const lunchGroupsComplete = mealFacts.some(({ meal }) => meal.mealType === "L")
    ? [
        ["DV", "LV"],
        ["FI", "MP", "EG", "SO"],
        ["GR", "WG", "TU"]
      ].every((group) => group.some((category) => lunchCategories.has(category as FoodCategory)))
    : undefined;

  const unknownNutritionCount = mealFacts.reduce(
    (sum, current) => sum + current.facts.unknownItems.length,
    0
  );
  const unknownOil = mealFacts.some(({ meal }) => meal.unknownOil);
  const reliabilityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const nutritionReliability = mealFacts.reduce<DailyAssessment["nutritionReliability"]>(
    (current, entry) => {
      const next = resolveNutritionReliability(entry.facts);
      return reliabilityRank[next] > reliabilityRank[current] ? next : current;
    },
    "HIGH"
  );
  const warnings: string[] = [];
  if (unknownOil) warnings.push("有餐次油量未知，当前营养数字只是已知小计，脂肪和能量可能被低估。 ");
  if (mealFacts.some(({ meal }) => meal.unknownSalt)) warnings.push("有餐次盐量未知，本应用不估算确定钠摄入。 ");
  if (unknownNutritionCount > 0) warnings.push("部分食物没有可靠营养数据，当前营养数字只是已知小计。 ");
  if (mealFacts.some(({ facts }) => facts.items.some((item) => item.calculationBasis === "RECIPE"))) {
    warnings.push("部分食物使用通用配方或组合餐估值，已计入营养区间，但不代表门店或家庭实际配方。 ");
  }
  if (nutritionReliability === "LOW") {
    warnings.push("本日含低置信度组合餐估算，可查看已知小计，但不计入可靠周营养平均。 ");
  }
  if (incomparableGroups.size > 0) warnings.push("部分食物组存在熟重、体积或折算口径问题，相关克数仅显示可比较的已知小计，不判断已达标。 ");
  if (diversityEstimated) warnings.push("部分食材无法确认是否达到5克，多样性只统计明确达到门槛的食材。 ");

  return {
    date,
    completed: options.completed,
    nutrition,
    groups,
    breakfastScore,
    lunchGroupsComplete,
    foodVarietyCount: foodNames.size,
    foodNames: [...foodNames],
    diversityEstimated,
    unknownNutritionCount,
    incomparableGroups: [...incomparableGroups],
    nutritionComplete: unknownNutritionCount === 0 && !unknownOil,
    nutritionReliability,
    nutritionKnownItemCount: mealFacts.reduce((sum, current) => sum + current.facts.knownItemCount, 0),
    nutritionTotalItemCount: mealFacts.reduce((sum, current) => sum + current.facts.totalItemCount, 0),
    unknownOil,
    waterMl: options.waterMl,
    warnings: warnings.map((warning) => warning.trim()),
    targets,
    presentCategories: [...categories]
  };
}
