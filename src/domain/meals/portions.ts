import type { MealItemInput, QuantityUnit } from "./types";

export function formatQuantityRange(item: MealItemInput): string {
  const range = item.quantityMin === item.quantityMax
    ? String(item.quantityMin)
    : `${item.quantityMin}～${item.quantityMax}`;
  return `${range}${item.unit}`;
}

export function isWeightUnit(unit: QuantityUnit): boolean {
  return unit === "g" || unit === "ml";
}

