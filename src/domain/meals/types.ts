export const FOOD_CATEGORIES = [
  "GR",
  "WG",
  "TU",
  "DV",
  "LV",
  "FR",
  "FI",
  "MP",
  "EG",
  "DA",
  "SO",
  "NS",
  "OI",
  "SD",
  "AL",
  "UP",
  "OT"
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_STATES = ["RW", "CK", "EA", "PK", "UN"] as const;
export type FoodState = (typeof FOOD_STATES)[number];

export const MEAL_TYPES = ["B", "L", "D", "S"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const QUANTITY_UNITS = ["g", "ml", "pc"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface MealItemInput {
  tempId: string;
  name: string;
  category: FoodCategory;
  state: FoodState;
  quantityMin: number;
  quantityMax: number;
  unit: QuantityUnit;
  canonicalFoodId?: string;
}

export interface ParsedMeal {
  protocolVersion: "HD1";
  eatenAt: string;
  date: string;
  mealType: MealType;
  items: MealItemInput[];
  cookingMethod: string;
  note: string;
  rawImportLine: string;
  unknownOil: boolean;
  unknownSalt: boolean;
}

export interface ConfirmedMeal extends ParsedMeal {
  id: string;
  ruleSetVersion: string;
  targetSnapshot?: unknown;
  nutritionSnapshot?: unknown;
  nutritionSnapshotOrigin?: "CONFIRMED" | "MIGRATED";
  createdAt: string;
  updatedAt: string;
}

export interface Hd1ParseSuccess {
  ok: true;
  value: ParsedMeal;
}

export interface Hd1ParseFailure {
  ok: false;
  errors: string[];
}

export type Hd1ParseResult = Hd1ParseSuccess | Hd1ParseFailure;

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  GR: "普通谷物/精制主食",
  WG: "全谷物/杂豆",
  TU: "薯类",
  DV: "深色蔬菜",
  LV: "其他蔬菜",
  FR: "新鲜水果",
  FI: "鱼虾海产",
  MP: "畜禽肉",
  EG: "蛋",
  DA: "奶及奶制品",
  SO: "大豆及豆制品",
  NS: "坚果和种子",
  OI: "烹调油/显性脂肪",
  SD: "饮料（非奶/豆/酒）",
  AL: "酒精饮品",
  UP: "高加工食品",
  OT: "其他/待确认"
};

export const MEAL_LABELS: Record<MealType, string> = {
  B: "早餐",
  L: "午餐",
  D: "晚餐",
  S: "加餐"
};

