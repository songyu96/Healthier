import { z } from "zod";
import { FOOD_CATEGORIES, isNutritionFacts } from "./domain";

const finiteNonNegative = z.number().finite().nonnegative();

const nutrientVectorSchema = z.object({
  kcal: finiteNonNegative,
  protein: finiteNonNegative,
  fat: finiteNonNegative,
  carb: finiteNonNegative,
  fiber: finiteNonNegative
}).strict();

const nutrientRangeSchema = z.object({
  min: nutrientVectorSchema,
  max: nutrientVectorSchema
}).strict().superRefine((range, context) => {
  (["kcal", "protein", "fat", "carb", "fiber"] as const).forEach((key) => {
    if (range.min[key] > range.max[key]) {
      context.addIssue({ code: "custom", message: `${key}营养范围倒置` });
    }
  });
});

const itemNutritionFactSchema = z.object({
  tempId: z.string().min(1),
  foodId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(FOOD_CATEGORIES),
  basisUnit: z.enum(["g", "ml"]),
  basisQuantityMin: finiteNonNegative,
  basisQuantityMax: finiteNonNegative,
  nutrients: nutrientRangeSchema,
  sourceRef: z.string().min(1)
}).strict().refine(
  (item) => item.basisQuantityMin <= item.basisQuantityMax,
  "营养事实数量范围倒置"
);

const unknownNutritionItemSchema = z.object({
  tempId: z.string().min(1),
  name: z.string().min(1),
  reason: z.string().min(1)
}).strict();

export const nutritionFactsSchema = z.object({
  mealId: z.string().min(1),
  totals: nutrientRangeSchema,
  items: z.array(itemNutritionFactSchema),
  unknownItems: z.array(unknownNutritionItemSchema),
  sourceRefs: z.array(z.string().min(1)),
  complete: z.boolean(),
  knownItemCount: z.number().int().nonnegative(),
  totalItemCount: z.number().int().nonnegative()
}).strict().superRefine((facts, context) => {
  if (facts.knownItemCount !== facts.items.length) {
    context.addIssue({ code: "custom", message: "已知营养项计数不一致" });
  }
  if (facts.totalItemCount !== facts.items.length + facts.unknownItems.length) {
    context.addIssue({ code: "custom", message: "营养项总数不一致" });
  }
  if (facts.complete !== (facts.unknownItems.length === 0)) {
    context.addIssue({ code: "custom", message: "营养完整状态与未知项不一致" });
  }
  if (!isNutritionFacts(facts)) {
    context.addIssue({ code: "custom", message: "营养快照计算语义不一致" });
  }
});
