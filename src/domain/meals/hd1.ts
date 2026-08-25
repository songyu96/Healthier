import { z } from "zod";
import {
  FOOD_CATEGORIES,
  FOOD_STATES,
  MEAL_TYPES,
  QUANTITY_UNITS,
  type FoodCategory,
  type FoodState,
  type Hd1ParseResult,
  type MealItemInput,
  type MealType,
  type ParsedMeal,
  type QuantityUnit
} from "./types";

const mealTypeSchema = z.enum(MEAL_TYPES);
const categorySchema = z.enum(FOOD_CATEGORIES);
const stateSchema = z.enum(FOOD_STATES);
const unitSchema = z.enum(QUANTITY_UNITS);
const datePattern = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/;
const quantityPattern = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(g|ml|pc)$/;
const storedDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseDateTime(value: string): { eatenAt: string; date: string } | null {
  const match = datePattern.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  const pad = (number: number) => String(number).padStart(2, "0");
  const dateKey = `${year}-${pad(month)}-${pad(day)}`;
  return {
    date: dateKey,
    eatenAt: `${dateKey}T${pad(hour)}:${pad(minute)}:00`
  };
}

function parseItem(value: string, index: number): { item?: MealItemInput; error?: string } {
  const fields = value.split("~");
  if (fields.length !== 4) {
    return { error: `第${index + 1}项食物必须包含名称、分类、状态和数量4个字段。` };
  }

  const [rawName, rawCategory, rawState, rawQuantity] = fields;
  const name = rawName.trim();
  if (!name) return { error: `第${index + 1}项食物名称不能为空。` };

  const categoryResult = categorySchema.safeParse(rawCategory);
  if (!categoryResult.success) return { error: `“${name}”的分类代码无效：${rawCategory}` };

  const stateResult = stateSchema.safeParse(rawState);
  if (!stateResult.success) return { error: `“${name}”的食物状态无效：${rawState}` };

  const quantityMatch = quantityPattern.exec(rawQuantity);
  if (!quantityMatch) return { error: `“${name}”的数量必须是“最小值-最大值g/ml/pc”。` };

  const quantityMin = Number(quantityMatch[1]);
  const quantityMax = Number(quantityMatch[2]);
  const unitResult = unitSchema.safeParse(quantityMatch[3]);
  if (
    !unitResult.success ||
    !Number.isFinite(quantityMin) ||
    !Number.isFinite(quantityMax) ||
    quantityMin < 0 || quantityMax <= 0 || quantityMin > quantityMax
  ) {
    return { error: `“${name}”的数量范围无效。` };
  }

  return {
    item: {
      tempId: `item-${index + 1}`,
      name,
      category: categoryResult.data as FoodCategory,
      state: stateResult.data as FoodState,
      quantityMin,
      quantityMax,
      unit: unitResult.data as QuantityUnit
    }
  };
}

function isValidStoredDateTime(value: string, expectedDate: string): boolean {
  const match = storedDateTimePattern.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(year, month - 1, day, hour, minute, second);
  const pad = (part: number) => String(part).padStart(2, "0");
  const actualDate = `${year}-${pad(month)}-${pad(day)}`;
  return actualDate === expectedDate &&
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day &&
    date.getHours() === hour && date.getMinutes() === minute && date.getSeconds() === second;
}

export function validateMealDraft(
  meal: Pick<ParsedMeal, "date" | "eatenAt" | "items">
): string[] {
  const errors: string[] = [];
  if (!isValidStoredDateTime(meal.eatenAt, meal.date)) {
    errors.push("进餐时间必须是有效日期时间，并与记录日期一致。");
  }
  if (meal.items.length === 0) errors.push("至少需要一项食物。");
  meal.items.forEach((item, index) => {
    if (!item.name.trim()) errors.push(`第${index + 1}项食物名称不能为空。`);
    if (
      !Number.isFinite(item.quantityMin) || !Number.isFinite(item.quantityMax) ||
      item.quantityMin < 0 || item.quantityMax <= 0 || item.quantityMin > item.quantityMax
    ) {
      errors.push(`“${item.name || `第${index + 1}项食物`}”的重量范围无效。`);
    }
  });
  return errors;
}

const UNKNOWN_NOTE_WORDS = "未知|不详|不清楚|没看清|不确定|未记录|无法确认";

function noteSuggestsUnknown(note: string, subject: "油" | "盐"): boolean {
  return new RegExp(`${subject}[^|;]{0,8}(?:${UNKNOWN_NOTE_WORDS})|(?:${UNKNOWN_NOTE_WORDS})[^|;]{0,8}${subject}`).test(note);
}

export function parseHd1(rawLine: string): Hd1ParseResult {
  const line = rawLine.trim();
  const errors: string[] = [];
  const fields = line.split("|");

  if (fields.length !== 6) {
    return { ok: false, errors: ["HD1记录必须包含6段，以“|”分隔。"] };
  }

  const [version, rawDateTime, rawMealType, rawItems, cookingMethod, note] = fields;
  if (version !== "HD1") errors.push("只支持HD1协议。 ");

  const dateTime = parseDateTime(rawDateTime);
  if (!dateTime) errors.push("日期时间必须是有效的YYYYMMDD-HHmm格式。 ");

  const mealTypeResult = mealTypeSchema.safeParse(rawMealType);
  if (!mealTypeResult.success) errors.push("餐次必须是B、L、D或S。 ");

  const itemParts = rawItems.split(";").filter(Boolean);
  if (itemParts.length === 0) errors.push("至少需要一项食物。 ");

  const items: MealItemInput[] = [];
  itemParts.forEach((itemText, index) => {
    const result = parseItem(itemText, index);
    if (result.error) errors.push(result.error);
    if (result.item) items.push(result.item);
  });

  if (errors.length > 0 || !dateTime || !mealTypeResult.success) {
    return { ok: false, errors: errors.map((error) => error.trim()) };
  }

  return {
    ok: true,
    value: {
      protocolVersion: "HD1",
      ...dateTime,
      mealType: mealTypeResult.data as MealType,
      items,
      cookingMethod: cookingMethod.trim() || "UNKNOWN",
      note: note.trim(),
      rawImportLine: rawLine,
      unknownOil: noteSuggestsUnknown(note, "油"),
      unknownSalt: noteSuggestsUnknown(note, "盐")
    }
  };
}

