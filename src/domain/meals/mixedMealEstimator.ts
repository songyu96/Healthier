import type { MealItemInput, MealType, ParsedMeal } from "./types";

export const MIXED_MEAL_KINDS = ["HOTPOT", "MALATANG", "BARBECUE"] as const;
export type MixedMealKind = (typeof MIXED_MEAL_KINDS)[number];

export const SEASONING_LEVELS = ["LIGHT", "NORMAL", "HEAVY"] as const;
export type SeasoningLevel = (typeof SEASONING_LEVELS)[number];

export const MIXED_MEAL_LABELS: Record<MixedMealKind, string> = {
  HOTPOT: "火锅",
  MALATANG: "麻辣烫",
  BARBECUE: "烧烤"
};

export const SEASONING_LABELS: Record<SeasoningLevel, string> = {
  LIGHT: "清淡/少蘸料",
  NORMAL: "普通",
  HEAVY: "偏油/重蘸料"
};

export interface MixedMealEstimateInput {
  kind: MixedMealKind;
  eatenAt: string;
  mealType: MealType;
  meatG: number;
  fishG: number;
  eggG: number;
  vegetableG: number;
  grainG: number;
  tuberG: number;
  soyG: number;
  seasoningLevel: SeasoningLevel;
}

function hd1Timestamp(eatenAt: string): string {
  return eatenAt.slice(0, 16).replaceAll("-", "").replace("T", "-").replace(":", "");
}

function item(
  mealLabel: string,
  partLabel: string,
  category: MealItemInput["category"],
  state: MealItemInput["state"],
  quantityMin: number,
  quantityMax: number,
  canonicalFoodId: string
): MealItemInput {
  return {
    tempId: crypto.randomUUID(),
    name: `${mealLabel}${partLabel}（估算）`,
    category,
    state,
    quantityMin,
    quantityMax,
    unit: "g",
    canonicalFoodId
  };
}

function serializeItems(items: MealItemInput[]): string {
  return items.map((value) =>
    `${value.name}~${value.category}~${value.state}~${value.quantityMin}-${value.quantityMax}${value.unit}`
  ).join(";");
}

export function createMixedMealDraft(input: MixedMealEstimateInput): ParsedMeal {
  const label = MIXED_MEAL_LABELS[input.kind];
  const items: MealItemInput[] = [];
  if (input.meatG > 0) items.push(item(label, "畜禽肉", "MP", "CK", input.meatG, input.meatG, "mixed-meal-meat-estimate"));
  if (input.fishG > 0) items.push(item(label, "鱼虾", "FI", "CK", input.fishG, input.fishG, "mixed-meal-fish-estimate"));
  if (input.eggG > 0) items.push(item(label, "蛋", "EG", "CK", input.eggG, input.eggG, "mixed-meal-egg-estimate"));
  if (input.vegetableG > 0) items.push(item(label, "蔬菜", "LV", "CK", input.vegetableG, input.vegetableG, "mixed-meal-vegetable-estimate"));
  if (input.grainG > 0) items.push(item(label, "谷物主食", "GR", "CK", input.grainG, input.grainG, "mixed-meal-staple-estimate"));
  if (input.tuberG > 0) items.push(item(label, "薯类", "TU", "CK", input.tuberG, input.tuberG, "mixed-meal-tuber-estimate"));
  if (input.soyG > 0) items.push(item(label, "豆制品", "SO", "CK", input.soyG, input.soyG, "mixed-meal-soy-estimate"));

  const note = `${label}组合餐估算；各类按熟重/可食重量；调味程度：${SEASONING_LABELS[input.seasoningLevel]}；油、盐和汤底固形物未知`;
  return {
    protocolVersion: "HD1",
    eatenAt: input.eatenAt,
    date: input.eatenAt.slice(0, 10),
    mealType: input.mealType,
    items,
    cookingMethod: label,
    note,
    rawImportLine: `HD1|${hd1Timestamp(input.eatenAt)}|${input.mealType}|${serializeItems(items)}|${label}|${note}`,
    unknownOil: true,
    unknownSalt: true
  };
}
