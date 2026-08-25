import type { FoodCategory } from "../meals/types";
import type { NutrientRange, NutrientVector } from "../nutrition/types";
import type {
  DailyAssessment,
  DailyTargets,
  FoodGroupTotals,
  MealWithFacts,
  RangeValue
} from "./types";

const ZERO_RANGE = (): RangeValue => ({ min: 0, max: 0 });
const ZERO_NUTRIENTS = (): NutrientVector => ({ kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 });

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

function addGroup(groups: FoodGroupTotals, category: FoodCategory, min: number, max: number): void {
  if (["GR", "WG", "TU"].includes(category)) addRange(groups.grain, min, max);
  if (category === "WG") addRange(groups.wholeGrain, min, max);
  if (category === "TU") addRange(groups.tuber, min, max);
  if (["DV", "LV"].includes(category)) addRange(groups.vegetable, min, max);
  if (category === "DV") addRange(groups.darkVegetable, min, max);
  if (category === "FR") addRange(groups.fruit, min, max);
  if (category === "DA") addRange(groups.dairy, min, max);
  if (["FI", "MP", "EG"].includes(category)) addRange(groups.animalFood, min, max);
  if (category === "FI") addRange(groups.fish, min, max);
  if (category === "MP") addRange(groups.meat, min, max);
  if (category === "EG") addRange(groups.egg, min, max);
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

  mealFacts.forEach(({ meal, facts }) => {
    const factsByTempId = new Map(facts.items.map((item) => [item.tempId, item]));
    meal.items.forEach((item) => {
      categories.add(item.category);
      foodNames.add(item.name.trim().toLocaleLowerCase("zh-CN"));
      const fact = factsByTempId.get(item.tempId);
      if (fact) {
        addGroup(groups, fact.category, fact.basisQuantityMin, fact.basisQuantityMax);
      } else if (item.unit !== "pc") {
        addGroup(groups, item.category, item.quantityMin, item.quantityMax);
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

  const warnings: string[] = [];
  if (mealFacts.some(({ meal }) => meal.unknownOil)) warnings.push("有餐次油量未知，脂肪和能量可能被低估。 ");
  if (mealFacts.some(({ meal }) => meal.unknownSalt)) warnings.push("有餐次盐量未知，本应用不估算确定钠摄入。 ");
  if (mealFacts.some(({ facts }) => facts.unknownItems.length > 0)) warnings.push("部分食物没有可靠营养数据，只参与食物组记录。 ");

  return {
    date,
    completed: options.completed,
    nutrition,
    groups,
    breakfastScore,
    lunchGroupsComplete,
    foodVarietyCount: foodNames.size,
    foodNames: [...foodNames],
    unknownNutritionCount: mealFacts.reduce((sum, current) => sum + current.facts.unknownItems.length, 0),
    unknownOil: mealFacts.some(({ meal }) => meal.unknownOil),
    waterMl: options.waterMl,
    warnings: warnings.map((warning) => warning.trim()),
    targets,
    presentCategories: [...categories]
  };
}

