import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDir = process.argv[2];
if (!sourceDir) {
  throw new Error("用法：node scripts/generate-food-data.mjs <USDA-SR28目录>");
}

const selectionPath = resolve("scripts/sr28-selection.json");
const outputPath = resolve("src/domain/nutrition/foodData.ts");
const selection = JSON.parse(await readFile(selectionPath, "utf8"));
const wantedIds = new Set(selection.map((food) => food.ndbNo));
const nutrientNumbers = {
  "208": "kcal",
  "203": "protein",
  "204": "fat",
  "205": "carb",
  "291": "fiber"
};

const stripTilde = (value) => value.startsWith("~") && value.endsWith("~")
  ? value.slice(1, -1)
  : value;
const parseRows = (text) => text
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split("^").map(stripTilde));

const descriptions = new Map();
for (const row of parseRows(await readFile(resolve(sourceDir, "FOOD_DES.txt"), "latin1"))) {
  if (wantedIds.has(row[0])) descriptions.set(row[0], row[2]);
}

const nutrientsByFood = new Map();
for (const food of selection) {
  nutrientsByFood.set(food.ndbNo, { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 });
}

for (const row of parseRows(await readFile(resolve(sourceDir, "NUT_DATA.txt"), "latin1"))) {
  const [foodId, nutrientNumber, value] = row;
  const property = nutrientNumbers[nutrientNumber];
  if (wantedIds.has(foodId) && property) {
    nutrientsByFood.get(foodId)[property] = Number(value);
  }
}

for (const food of selection) {
  if (!descriptions.has(food.ndbNo)) throw new Error(`找不到USDA食物：${food.ndbNo}`);
}

const generatedFoods = selection.map(({ ndbNo, states, ...food }) => ({
  ...food,
  compatibleStates: states,
  nutrientsPer100: nutrientsByFood.get(ndbNo),
  source: {
    kind: "USDA_FDC",
    ref: `SR28:${ndbNo}`,
    release: "USDA SR28 (2015)"
  },
  sourceDescription: descriptions.get(ndbNo)
}));

const contents = `// 由 scripts/generate-food-data.mjs 从 USDA SR28 原始数据机械生成。\n` +
`// 不要手工修改营养值；中文别名和分类维护在 scripts/sr28-selection.json。\n` +
`import type { FoodReference } from "./types";\n\n` +
`export const BASE_FOODS: FoodReference[] = ${JSON.stringify(generatedFoods, null, 2)};\n\n` +
`export function mergeFoodReferences(base: FoodReference[], overrides: FoodReference[]): FoodReference[] {\n` +
`  const foods = new Map(base.map((food) => [food.id, food]));\n` +
`  overrides.forEach((food) => foods.set(food.id, food));\n` +
`  return [...foods.values()];\n` +
`}\n`;

await writeFile(outputPath, contents, { encoding: "utf8" });
console.log(`Generated ${generatedFoods.length} foods at ${outputPath}`);

