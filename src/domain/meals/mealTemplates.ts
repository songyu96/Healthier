import type { MealItemInput, MealType, ParsedMeal } from "./types";

export interface MealTemplate {
  id: string;
  name: string;
  description: string;
  mealType: MealType;
  cookingMethod: string;
  unknownOil: boolean;
  unknownSalt: boolean;
  items: Omit<MealItemInput, "tempId">[];
}

export const MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: "breakfast-bread-egg-milk-fruit",
    name: "面包蛋奶水果",
    description: "全麦面包、鸡蛋、牛奶、苹果",
    mealType: "B",
    cookingMethod: "即食/水煮",
    unknownOil: false,
    unknownSalt: false,
    items: [
      { name: "全麦面包", category: "WG", state: "EA", quantityMin: 50, quantityMax: 80, unit: "g", canonicalFoodId: "bread-whole-wheat" },
      { name: "鸡蛋", category: "EG", state: "CK", quantityMin: 1, quantityMax: 1, unit: "pc", canonicalFoodId: "egg-hard-boiled" },
      { name: "牛奶", category: "DA", state: "EA", quantityMin: 250, quantityMax: 250, unit: "ml", canonicalFoodId: "milk-whole" },
      { name: "苹果", category: "FR", state: "EA", quantityMin: 100, quantityMax: 200, unit: "g", canonicalFoodId: "apple-raw" }
    ]
  },
  {
    id: "rice-chicken-broccoli",
    name: "米饭鸡胸西兰花",
    description: "熟重搭配，油盐由你确认",
    mealType: "L",
    cookingMethod: "蒸煮/清炒",
    unknownOil: true,
    unknownSalt: true,
    items: [
      { name: "米饭", category: "GR", state: "CK", quantityMin: 150, quantityMax: 200, unit: "g", canonicalFoodId: "rice-white-cooked" },
      { name: "鸡胸肉", category: "MP", state: "CK", quantityMin: 100, quantityMax: 150, unit: "g", canonicalFoodId: "chicken-breast-roasted" },
      { name: "西兰花", category: "DV", state: "CK", quantityMin: 150, quantityMax: 250, unit: "g", canonicalFoodId: "broccoli-cooked" }
    ]
  },
  {
    id: "brown-rice-beef-vegetables",
    name: "糙米牛肉双蔬菜",
    description: "糙米、瘦牛肉、西兰花、胡萝卜",
    mealType: "L",
    cookingMethod: "蒸煮/清炒",
    unknownOil: true,
    unknownSalt: true,
    items: [
      { name: "糙米饭", category: "WG", state: "CK", quantityMin: 150, quantityMax: 200, unit: "g", canonicalFoodId: "rice-brown-cooked" },
      { name: "瘦牛肉", category: "MP", state: "CK", quantityMin: 100, quantityMax: 150, unit: "g", canonicalFoodId: "beef-round-roasted" },
      { name: "西兰花", category: "DV", state: "CK", quantityMin: 100, quantityMax: 150, unit: "g", canonicalFoodId: "broccoli-cooked" },
      { name: "胡萝卜", category: "DV", state: "CK", quantityMin: 50, quantityMax: 100, unit: "g", canonicalFoodId: "carrot-cooked" }
    ]
  },
  {
    id: "noodles-egg-spinach",
    name: "面条鸡蛋菠菜",
    description: "熟面、鸡蛋、熟菠菜",
    mealType: "L",
    cookingMethod: "水煮",
    unknownOil: false,
    unknownSalt: true,
    items: [
      { name: "面条", category: "GR", state: "CK", quantityMin: 180, quantityMax: 250, unit: "g", canonicalFoodId: "egg-noodles-cooked" },
      { name: "鸡蛋", category: "EG", state: "CK", quantityMin: 1, quantityMax: 1, unit: "pc", canonicalFoodId: "egg-hard-boiled" },
      { name: "菠菜", category: "DV", state: "CK", quantityMin: 100, quantityMax: 200, unit: "g", canonicalFoodId: "spinach-cooked" }
    ]
  },
  {
    id: "rice-salmon-spinach",
    name: "米饭三文鱼菠菜",
    description: "熟重搭配，油盐由你确认",
    mealType: "D",
    cookingMethod: "蒸煮/烤制",
    unknownOil: true,
    unknownSalt: true,
    items: [
      { name: "米饭", category: "GR", state: "CK", quantityMin: 100, quantityMax: 150, unit: "g", canonicalFoodId: "rice-white-cooked" },
      { name: "三文鱼", category: "FI", state: "CK", quantityMin: 100, quantityMax: 150, unit: "g", canonicalFoodId: "salmon-cooked" },
      { name: "菠菜", category: "DV", state: "CK", quantityMin: 150, quantityMax: 250, unit: "g", canonicalFoodId: "spinach-cooked" }
    ]
  }
];

function hd1Timestamp(eatenAt: string): string {
  return eatenAt.slice(0, 16).replaceAll("-", "").replace("T", "-").replace(":", "");
}

function serializeItems(items: MealTemplate["items"]): string {
  return items
    .map((item) => item.name + "~" + item.category + "~" + item.state + "~" + item.quantityMin + "-" + item.quantityMax + item.unit)
    .join(";");
}

export function createMealDraftFromTemplate(template: MealTemplate, eatenAt: string): ParsedMeal {
  const note = "搭配模板：" + template.name + (template.unknownOil && template.unknownSalt ? "；油盐未知" : template.unknownOil ? "；油量未知" : template.unknownSalt ? "；盐量未知" : "");
  return {
    protocolVersion: "HD1",
    eatenAt,
    date: eatenAt.slice(0, 10),
    mealType: template.mealType,
    items: template.items.map((item) => ({ ...item, tempId: crypto.randomUUID() })),
    cookingMethod: template.cookingMethod,
    note,
    rawImportLine: "HD1|" + hd1Timestamp(eatenAt) + "|" + template.mealType + "|" + serializeItems(template.items) + "|" + template.cookingMethod + "|" + note,
    unknownOil: template.unknownOil,
    unknownSalt: template.unknownSalt
  };
}

