import type { FoodReference, NutrientVector } from "./types";

const FNDDS_RELEASE = "USDA FNDDS 2021–2023 (2024-10-31)";
const FNDDS_CAVEAT = "FNDDS 通用条目采用美国膳食调查口径；实际品牌、门店配方和份量可能不同，仅用于近似记录。";
const LIQUID_CAVEAT = "FNDDS 原值按100克提供；饮品记录近似按1克≈1毫升换算。";
const COMMON_FOODS_V2 = "Healthier common-foods-v2";
const RECIPE_RELEASE = "Healthier representative-recipes-v1";

interface RecipeIngredientSeed {
  name: string;
  weightG: number;
  nutrientsPer100: NutrientVector;
}

type RecipeSeed = Omit<FoodReference, "nutrientsPer100" | "source" | "dataCaveats" | "recipeEstimate"> & {
  finalWeightG: number;
  ingredients: RecipeIngredientSeed[];
  caveats: string[];
  confidence?: "MEDIUM" | "LOW";
};

const ZERO_NUTRIENTS: NutrientVector = { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 };
const FLOUR: NutrientVector = { kcal: 364, protein: 10.3, fat: 1, carb: 76.3, fiber: 2.7 };
const OIL: NutrientVector = { kcal: 884, protein: 0, fat: 100, carb: 0, fiber: 0 };
const EGG: NutrientVector = { kcal: 155, protein: 12.6, fat: 10.6, carb: 1.1, fiber: 0 };
const TOMATO: NutrientVector = { kcal: 18, protein: 0.9, fat: 0.2, carb: 3.9, fiber: 1.2 };
const BOK_CHOY: NutrientVector = { kcal: 20.3, protein: 1.02, fat: 0.234, carb: 3.51, fiber: 1.26 };
const LEAN_PORK: NutrientVector = { kcal: 242, protein: 27.3, fat: 13.9, carb: 0, fiber: 0 };
const PORK_BELLY: NutrientVector = { kcal: 518, protein: 9.34, fat: 53, carb: 0, fiber: 0 };
const COOKED_BEEF: NutrientVector = { kcal: 200, protein: 29, fat: 8, carb: 0, fiber: 0 };
const COOKED_CHICKEN: NutrientVector = { kcal: 165, protein: 31, fat: 3.6, carb: 0, fiber: 0 };
const COOKED_SALMON: NutrientVector = { kcal: 182, protein: 25.44, fat: 8.13, carb: 0, fiber: 0 };
const COOKED_COD: NutrientVector = { kcal: 105, protein: 22.83, fat: 0.86, carb: 0, fiber: 0 };
const COOKED_SHRIMP: NutrientVector = { kcal: 119, protein: 22.78, fat: 1.7, carb: 1.52, fiber: 0 };
const COOKED_POTATO: NutrientVector = { kcal: 86, protein: 1.71, fat: 0.1, carb: 20.01, fiber: 1.8 };
const COOKED_SWEET_POTATO: NutrientVector = { kcal: 90, protein: 2.01, fat: 0.15, carb: 20.71, fiber: 3.3 };
const COOKED_NOODLES: NutrientVector = { kcal: 138, protein: 4.5, fat: 2.1, carb: 25, fiber: 1.2 };
const COOKED_RICE: NutrientVector = { kcal: 130, protein: 2.69, fat: 0.28, carb: 28.17, fiber: 0.4 };
const COOKED_BROCCOLI: NutrientVector = { kcal: 35, protein: 2.38, fat: 0.41, carb: 7.18, fiber: 3.3 };
const TOFU: NutrientVector = { kcal: 100, protein: 10, fat: 5, carb: 4, fiber: 1 };
const CABBAGE: NutrientVector = { kcal: 13, protein: 1.5, fat: 0.2, carb: 2.2, fiber: 1 };
const SUGAR: NutrientVector = { kcal: 387, protein: 0, fat: 0, carb: 100, fiber: 0 };

function recipe(seed: RecipeSeed): FoodReference {
  const { finalWeightG, ingredients, caveats, confidence = "MEDIUM", ...food } = seed;
  const totals = ingredients.reduce<NutrientVector>((sum, ingredient) => {
    const factor = ingredient.weightG / 100;
    return {
      kcal: sum.kcal + ingredient.nutrientsPer100.kcal * factor,
      protein: sum.protein + ingredient.nutrientsPer100.protein * factor,
      fat: sum.fat + ingredient.nutrientsPer100.fat * factor,
      carb: sum.carb + ingredient.nutrientsPer100.carb * factor,
      fiber: sum.fiber + ingredient.nutrientsPer100.fiber * factor
    };
  }, { ...ZERO_NUTRIENTS });
  const per100 = (value: number) => Number((value * 100 / finalWeightG).toFixed(2));
  return {
    ...food,
    nutrientsPer100: {
      kcal: per100(totals.kcal), protein: per100(totals.protein), fat: per100(totals.fat),
      carb: per100(totals.carb), fiber: per100(totals.fiber)
    },
    dataCaveats: ["按代表性配方和成品重量计算，仅用于个人记录估算。", ...caveats],
    recipeEstimate: {
      finalWeightG,
      ingredients: ingredients.map(({ name, weightG }) => ({ name, weightG })),
      confidence
    },
    source: { kind: "REFERENCE", ref: `RECIPE:${food.id}`, release: RECIPE_RELEASE, method: "RECIPE" },
    sourceDescription: "应用内代表性配方估值"
  };
}

type FnddsSeed = Omit<FoodReference, "source" | "dataCaveats"> & {
  fdcId: string;
  sourceDescription: string;
  caveats?: string[];
};

function fndds(seed: FnddsSeed): FoodReference {
  const { fdcId, sourceDescription, caveats = [], ...food } = seed;
  return {
    ...food,
    dataCaveats: [FNDDS_CAVEAT, ...caveats],
    source: {
      kind: "USDA_FDC",
      ref: `FDC:${fdcId}`,
      release: FNDDS_RELEASE,
      method: "OFFICIAL_COMPOSITION"
    },
    sourceDescription
  };
}

type UsdaSeed = Omit<FoodReference, "source" | "dataCaveats"> & {
  fdcId: string;
  release: string;
  sourceDescription: string;
  caveats?: string[];
};

function usda(seed: UsdaSeed): FoodReference {
  const { fdcId, release, sourceDescription, caveats = [], ...food } = seed;
  return {
    ...food,
    dataCaveats: caveats,
    source: { kind: "USDA_FDC", ref: `FDC:${fdcId}`, release, method: "OFFICIAL_COMPOSITION" },
    sourceDescription
  };
}

export const COMMON_FOODS: FoodReference[] = [
  fndds({
    id: "coffee-brewed-current", name: "现煮黑咖啡", aliases: ["黑咖啡", "美式咖啡"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["咖啡", "早餐", "饮料"],
    nutrientsPer100: { kcal: 1, protein: 0.12, fat: 0.02, carb: 0, fiber: 0 },
    fdcId: "2710375", sourceDescription: "Coffee, brewed", caveats: [LIQUID_CAVEAT, "不包含另加的糖、奶或奶精。"]
  }),
  fndds({
    id: "coffee-espresso-current", name: "意式浓缩咖啡", aliases: ["浓缩咖啡", "Espresso"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["咖啡", "饮料"],
    nutrientsPer100: { kcal: 9, protein: 0.12, fat: 0.18, carb: 1.67, fiber: 0 },
    fdcId: "2710378", sourceDescription: "Coffee, espresso", caveats: [LIQUID_CAVEAT, "不包含另加的糖或奶。"]
  }),
  fndds({
    id: "coffee-latte-current", name: "拿铁咖啡（通用）", aliases: ["拿铁", "咖啡拿铁"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["咖啡", "奶咖", "饮料"],
    nutrientsPer100: { kcal: 43, protein: 2.81, fat: 1.61, carb: 4.35, fiber: 0 },
    fdcId: "2710386", sourceDescription: "Coffee, Latte", caveats: [LIQUID_CAVEAT, "牛奶种类、糖浆和杯型会显著改变营养值。"]
  }),
  fndds({
    id: "coffee-cappuccino-current", name: "卡布奇诺（通用）", aliases: ["卡布奇诺咖啡"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["咖啡", "奶咖", "饮料"],
    nutrientsPer100: { kcal: 27, protein: 1.71, fat: 0.99, carb: 2.75, fiber: 0 },
    fdcId: "2710472", sourceDescription: "Coffee, Cappuccino", caveats: [LIQUID_CAVEAT, "牛奶、奶泡和加糖量会改变营养值。"]
  }),
  fndds({
    id: "tea-black-unsweetened-current", name: "无糖红茶", aliases: ["冰红茶无糖", "不加糖红茶"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["茶", "无糖饮料"],
    nutrientsPer100: { kcal: 1, protein: 0, fat: 0, carb: 0.3, fiber: 0 },
    fdcId: "2710517", sourceDescription: "Tea, iced, brewed, black, unsweetened", caveats: [LIQUID_CAVEAT, "仅对应不加糖、不加奶的冲泡红茶。"]
  }),
  fndds({
    id: "tea-green-unsweetened-current", name: "无糖绿茶", aliases: ["冰绿茶无糖", "不加糖绿茶"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["茶", "无糖饮料"],
    nutrientsPer100: { kcal: 1, protein: 0.22, fat: 0, carb: 0, fiber: 0 },
    fdcId: "2710523", sourceDescription: "Tea, iced, brewed, green, unsweetened", caveats: [LIQUID_CAVEAT, "仅对应不加糖、不加奶的冲泡绿茶。"]
  }),
  fndds({
    id: "bao-bun-meat-current", name: "肉包（通用）", aliases: ["肉包子", "鲜肉包"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["包子", "早餐", "面点"],
    nutrientsPer100: { kcal: 273, protein: 11.2, fat: 7.58, carb: 39.8, fiber: 1.2 },
    fdcId: "2708724", sourceDescription: "Bao bun", caveats: ["对应美国膳食调查中的通用肉馅包；面皮、馅料和含油量可能与本地产品差异较大。"]
  }),
  fndds({
    id: "bao-bun-no-meat-current", name: "素包（通用）", aliases: ["素包子", "菜包", "蔬菜包"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["包子", "早餐", "面点", "素食"],
    nutrientsPer100: { kcal: 268, protein: 6.73, fat: 2.94, carb: 54.3, fiber: 3.4 },
    fdcId: "2708725", sourceDescription: "Bao bun, no meat", caveats: ["对应不含肉的通用包子，不代表特定蔬菜或豆沙馅。"]
  }),
  fndds({
    id: "fried-rice-nfs-current", name: "炒饭（通用）", aliases: ["蛋炒饭", "炒米饭"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["炒饭", "主食", "外卖"],
    nutrientsPer100: { kcal: 174, protein: 3.84, fat: 3.19, carb: 32.5, fiber: 1.1 },
    fdcId: "2708952", sourceDescription: "Rice, fried, NFS", caveats: ["NFS 表示未进一步说明配方；用油、鸡蛋和配菜差异可能很大。"]
  }),
  fndds({
    id: "fried-rice-chicken-current", name: "鸡肉炒饭（通用）", aliases: ["鸡肉蛋炒饭"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["炒饭", "鸡肉", "外卖"],
    nutrientsPer100: { kcal: 173, protein: 7.28, fat: 3.66, carb: 27.6, fiber: 0.9 },
    fdcId: "2708953", sourceDescription: "Rice, fried, with chicken", caveats: ["不拆分米饭、鸡肉、蔬菜和烹调油，不能据此判断各食物组是否达标。"]
  }),
  fndds({
    id: "ramen-bowl-nfs-current", name: "汤面/拉面（通用）", aliases: ["拉面", "汤面"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["面条", "汤面", "外卖"],
    nutrientsPer100: { kcal: 127, protein: 7.13, fat: 4.57, carb: 14, fiber: 0.9 },
    fdcId: "2709153", sourceDescription: "Ramen bowl, NFS", caveats: ["NFS 表示配方未进一步说明；汤底、肉类、面量和是否喝汤都会影响结果。"]
  }),
  fndds({
    id: "ramen-bowl-vegetarian-current", name: "素汤面/素拉面（通用）", aliases: ["素拉面", "蔬菜汤面"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["面条", "汤面", "素食"],
    nutrientsPer100: { kcal: 108, protein: 4.01, fat: 3.33, carb: 15.6, fiber: 1.1 },
    fdcId: "2709157", sourceDescription: "Ramen bowl, vegetarian", caveats: ["不拆分面条、蔬菜、豆制品和汤底。"]
  }),
  fndds({
    id: "sandwich-nfs-current", name: "三明治（通用）", aliases: ["夹心三明治"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["三明治", "早餐", "便利店"],
    nutrientsPer100: { kcal: 287, protein: 12.8, fat: 12, carb: 33.8, fiber: 1.9 },
    fdcId: "2706880", sourceDescription: "Sandwich, NFS", caveats: ["NFS 表示面包、夹馅和酱料未进一步说明；具体包装标签或拆分原料更可靠。"]
  }),
  fndds({
    id: "french-fries-fast-food-current", name: "快餐薯条", aliases: ["炸薯条", "薯条"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["快餐", "油炸", "聚餐"],
    nutrientsPer100: { kcal: 312, protein: 3.43, fat: 14.7, carb: 41.4, fiber: 3.8 },
    fdcId: "2709461", sourceDescription: "Potato, french fries, fast food", caveats: ["不同门店、粗细和炸制用油会影响结果。"]
  }),
  fndds({
    id: "fried-chicken-wing-fast-food-current", name: "快餐炸鸡翅", aliases: ["炸鸡翅", "油炸鸡翅"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["炸鸡", "快餐", "聚餐"],
    nutrientsPer100: { kcal: 323, protein: 17.8, fat: 21.3, carb: 15, fiber: 0.3 },
    fdcId: "2706067", sourceDescription: "Chicken wing, fried, coated, from fast food", caveats: ["对应带裹粉的快餐炸鸡翅；不适用于无裹粉烤鸡翅。"]
  }),
  fndds({
    id: "hot-dog-beef-white-bun-current", name: "牛肉热狗（白面包）", aliases: ["牛肉热狗"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["热狗", "快餐", "聚餐"],
    nutrientsPer100: { kcal: 296, protein: 10.8, fat: 17.4, carb: 23.7, fiber: 0.8 },
    fdcId: "2707060", sourceDescription: "Hot dog sandwich, beef, on white bun", caveats: ["不包含额外芝士、辣肉酱或其他酱料。"]
  }),
  fndds({
    id: "bagel-current", name: "原味贝果", aliases: ["贝果", "Bagel"],
    category: "GR", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["早餐", "面包", "烘焙"],
    nutrientsPer100: { kcal: 264, protein: 10.6, fat: 1.32, carb: 52.4, fiber: 1.6 },
    fdcId: "2707684", sourceDescription: "Bagel", caveats: ["不包含奶油奶酪、果酱、肉类或其他夹馅。"]
  }),
  fndds({
    id: "croissant-current", name: "原味羊角包", aliases: ["羊角包", "牛角包", "可颂"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["早餐", "面包", "烘焙"],
    nutrientsPer100: { kcal: 406, protein: 8.2, fat: 21, carb: 45.8, fiber: 2.6 },
    fdcId: "2707678", sourceDescription: "Croissant", caveats: ["仅对应无夹馅原味产品。"]
  }),
  fndds({
    id: "cookie-chocolate-chip-current", name: "巧克力豆曲奇", aliases: ["巧克力曲奇", "巧克力饼干"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["饼干", "零食", "甜点"],
    nutrientsPer100: { kcal: 492, protein: 5.1, fat: 24.7, carb: 65.4, fiber: 2 },
    fdcId: "2707909", sourceDescription: "Cookie, chocolate chip", caveats: ["品牌、大小和巧克力含量会改变营养值，包装标签优先。"]
  }),
  fndds({
    id: "doughnut-nfs-current", name: "甜甜圈（通用）", aliases: ["甜甜圈", "多拿滋"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["烘焙", "零食", "甜点"],
    nutrientsPer100: { kcal: 426, protein: 5.52, fat: 22.9, carb: 49.5, fiber: 1.8 },
    fdcId: "2708062", sourceDescription: "Doughnut, NFS", caveats: ["NFS 表示是否夹馅、糖霜和制作方式未进一步说明。"]
  }),
  fndds({
    id: "ice-cream-vanilla-current", name: "香草冰淇淋", aliases: ["香草雪糕"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["冷饮", "零食", "甜点"],
    nutrientsPer100: { kcal: 207, protein: 3.5, fat: 11, carb: 23.6, fiber: 0.7 },
    fdcId: "2705630", sourceDescription: "Ice cream, vanilla", caveats: ["不同乳脂含量、配料和品牌差异较大，包装标签优先。"]
  }),
  fndds({
    id: "popcorn-movie-butter-current", name: "影院黄油爆米花", aliases: ["电影院爆米花", "黄油爆米花"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["电影", "聚餐", "零食"],
    nutrientsPer100: { kcal: 656, protein: 4.96, fat: 58.8, carb: 31.6, fiber: 5.4 },
    fdcId: "2708217", sourceDescription: "Popcorn, movie theater, with added butter", caveats: ["影院配方和加油量差异很大；不适用于空气爆制原味爆米花。"]
  }),
  fndds({
    id: "chocolate-candy-current", name: "巧克力（通用）", aliases: ["巧克力糖", "朱古力"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["巧克力", "零食", "甜点"],
    nutrientsPer100: { kcal: 535, protein: 7.65, fat: 29.7, carb: 59.4, fiber: 3.4 },
    fdcId: "2710328", sourceDescription: "Chocolate candy", caveats: ["可可含量、夹心和坚果会显著改变营养值，具体包装标签优先。"]
  }),
  fndds({
    id: "chocolate-cake-bakery-current", name: "巧克力蛋糕（带巧克力糖霜）", aliases: ["巧克力蛋糕", "巧克力杯子蛋糕"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["蛋糕", "生日", "聚餐", "甜点"],
    nutrientsPer100: { kcal: 345, protein: 3.29, fat: 15.2, carb: 52.2, fiber: 1.6 },
    fdcId: "2707866", sourceDescription: "Cake or cupcake, chocolate with chocolate icing, bakery", caveats: ["对应烘焙店带巧克力糖霜产品；奶油和夹层差异可能很大。"]
  }),
  fndds({
    id: "beer-current", name: "啤酒（通用）", aliases: ["啤酒"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "聚餐", "饮料"],
    nutrientsPer100: { kcal: 43, protein: 0.46, fat: 0, carb: 3.55, fiber: 0 },
    fdcId: "2710616", sourceDescription: "Beer", caveats: [LIQUID_CAVEAT, "酒精度、原麦汁浓度和风格会改变能量与碳水。"]
  }),
  fndds({
    id: "wine-red-current", name: "红葡萄酒", aliases: ["红酒", "干红"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "葡萄酒", "聚餐"],
    nutrientsPer100: { kcal: 85, protein: 0.07, fat: 0, carb: 2.61, fiber: 0 },
    fdcId: "2710688", sourceDescription: "Wine, red", caveats: [LIQUID_CAVEAT, "甜度和酒精度会影响结果；具体酒标通常不提供完整营养值。"]
  }),
  fndds({
    id: "wine-white-current", name: "白葡萄酒", aliases: ["白葡萄酒", "干白"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "葡萄酒", "聚餐"],
    nutrientsPer100: { kcal: 82, protein: 0.07, fat: 0, carb: 2.6, fiber: 0 },
    fdcId: "2710689", sourceDescription: "Wine, white", caveats: [LIQUID_CAVEAT, "甜度和酒精度会影响结果。"]
  }),
  fndds({
    id: "wine-rice-current", name: "米酒（通用）", aliases: ["米酒", "黄酒"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "米酒", "聚餐"],
    nutrientsPer100: { kcal: 134, protein: 0.5, fat: 0, carb: 5, fiber: 0 },
    fdcId: "2710691", sourceDescription: "Wine, rice", caveats: [LIQUID_CAVEAT, "不能代表所有黄酒、清酒或烹调用米酒；酒精度和含糖量差异较大。"]
  }),
  fndds({
    id: "spirit-40-percent-current", name: "40%vol 烈酒（通用）", aliases: ["40度烈酒", "40度白酒"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "烈酒", "白酒", "聚餐"],
    nutrientsPer100: { kcal: 231, protein: 0, fat: 0, carb: 0, fiber: 0 },
    fdcId: "2710704", sourceDescription: "Vodka", caveats: ["以40%vol左右无糖蒸馏酒近似；白酒香型、酒精度和密度不同，不能用于精确计算。"]
  }),
  fndds({
    id: "watermelon-raw-current", name: "西瓜", aliases: ["鲜西瓜"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "夏季", "鲜果"],
    nutrientsPer100: { kcal: 30, protein: 0.61, fat: 0.15, carb: 7.55, fiber: 0.4 },
    fdcId: "2709270", sourceDescription: "Watermelon, raw"
  }),
  fndds({
    id: "tangerine-raw-current", name: "橘子", aliases: ["桔子", "蜜橘", "柑橘"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "鲜果"],
    nutrientsPer100: { kcal: 53, protein: 0.81, fat: 0.31, carb: 13.3, fiber: 1.8 },
    fdcId: "2709175", sourceDescription: "Tangerine, raw", caveats: ["不同柑橘品种会有差异，此条目用于普通橘子的近似记录。"]
  }),
  fndds({
    id: "peach-raw-current", name: "桃", aliases: ["桃子", "鲜桃"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "鲜果"],
    nutrientsPer100: { kcal: 46, protein: 0.91, fat: 0.27, carb: 10.1, fiber: 1.5 },
    fdcId: "2709249", sourceDescription: "Peach, raw"
  }),
  fndds({
    id: "mango-raw-current", name: "芒果", aliases: ["鲜芒果"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "热带水果", "鲜果"],
    nutrientsPer100: { kcal: 60, protein: 0.82, fat: 0.38, carb: 15, fiber: 1.6 },
    fdcId: "2709242", sourceDescription: "Mango, raw"
  }),
  fndds({
    id: "pineapple-raw-current", name: "菠萝", aliases: ["凤梨", "鲜菠萝"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "热带水果", "鲜果"],
    nutrientsPer100: { kcal: 60, protein: 0.46, fat: 0.21, carb: 14.1, fiber: 0.9 },
    fdcId: "2709260", sourceDescription: "Pineapple, raw"
  }),
  fndds({
    id: "cantaloupe-raw-current", name: "哈密瓜（通用）", aliases: ["哈密瓜", "甜瓜"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "瓜果", "鲜果"],
    nutrientsPer100: { kcal: 38, protein: 0.82, fat: 0.18, carb: 8.16, fiber: 0.8 },
    fdcId: "2709226", sourceDescription: "Cantaloupe, raw", caveats: ["以网纹甜瓜通用数据近似；不同哈密瓜品种甜度可能不同。"]
  }),
  fndds({
    id: "dragon-fruit-current", name: "火龙果", aliases: ["红心火龙果", "白心火龙果"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "热带水果", "鲜果"],
    nutrientsPer100: { kcal: 68, protein: 0.68, fat: 0.21, carb: 16.2, fiber: 1.8 },
    fdcId: "2709234", sourceDescription: "Dragon fruit", caveats: ["红心和白心品种存在差异，此条目只作通用近似。"]
  }),
  fndds({
    id: "blueberries-raw-current", name: "蓝莓", aliases: ["鲜蓝莓"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "浆果", "鲜果"],
    nutrientsPer100: { kcal: 64, protein: 0.7, fat: 0.31, carb: 14.6, fiber: 2.4 },
    fdcId: "2709275", sourceDescription: "Blueberries, raw"
  }),
  fndds({
    id: "cherries-raw-current", name: "樱桃", aliases: ["车厘子", "鲜樱桃"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "鲜果"],
    nutrientsPer100: { kcal: 71, protein: 1.04, fat: 0.19, carb: 16.2, fiber: 2.1 },
    fdcId: "2709231", sourceDescription: "Cherries, raw"
  }),
  fndds({
    id: "lychee-current", name: "荔枝", aliases: ["鲜荔枝"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "热带水果", "鲜果"],
    nutrientsPer100: { kcal: 66, protein: 0.83, fat: 0.44, carb: 16.5, fiber: 1.3 },
    fdcId: "2709240", sourceDescription: "Lychee"
  }),
  fndds({
    id: "chinese-cabbage-raw-current", name: "大白菜", aliases: ["白菜", "黄芽白"],
    category: "LV", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["蔬菜", "叶菜", "家常菜"],
    nutrientsPer100: { kcal: 13, protein: 1.5, fat: 0.2, carb: 2.18, fiber: 1 },
    fdcId: "2709774", sourceDescription: "Cabbage, Chinese, raw", caveats: ["对应大白菜通用生食材，不等同于小白菜或上海青。"]
  }),
  fndds({
    id: "celery-raw-current", name: "芹菜", aliases: ["西芹", "生芹菜"],
    category: "LV", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["蔬菜", "茎菜", "家常菜"],
    nutrientsPer100: { kcal: 17, protein: 0.49, fat: 0.16, carb: 3.32, fiber: 1.6 },
    fdcId: "2709778", sourceDescription: "Celery, raw"
  }),
  fndds({
    id: "eggplant-cooked-current", name: "熟茄子（未加油）", aliases: ["水煮茄子", "蒸茄子"],
    category: "LV", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["蔬菜", "茄子", "家常菜"],
    nutrientsPer100: { kcal: 27, protein: 1.05, fat: 0.19, carb: 6.3, fiber: 3.2 },
    fdcId: "2709929", sourceDescription: "Eggplant, cooked, no added fat", caveats: ["不包含炒制或红烧时吸收的烹调油。"]
  }),
  fndds({
    id: "green-pepper-raw-current", name: "青椒", aliases: ["绿甜椒", "青甜椒"],
    category: "DV", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["蔬菜", "深色蔬菜", "家常菜"],
    nutrientsPer100: { kcal: 23, protein: 0.72, fat: 0.11, carb: 4.78, fiber: 0.9 },
    fdcId: "2709800", sourceDescription: "Peppers, sweet, green, raw", caveats: ["对应不辣的绿色甜椒，不适用于尖椒等辛辣品种。"]
  }),
  fndds({
    id: "onions-raw-current", name: "洋葱", aliases: ["生洋葱"],
    category: "LV", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["蔬菜", "家常菜"],
    nutrientsPer100: { kcal: 38, protein: 0.86, fat: 0.08, carb: 8.46, fiber: 1.7 },
    fdcId: "2709795", sourceDescription: "Onions, raw"
  }),
  fndds({
    id: "pumpkin-cooked-current", name: "熟南瓜（通用）", aliases: ["南瓜", "蒸南瓜", "煮南瓜"],
    category: "DV", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["蔬菜", "深色蔬菜", "家常菜"],
    nutrientsPer100: { kcal: 52, protein: 1.05, fat: 2.84, carb: 6.77, fiber: 0.5 },
    fdcId: "2709692", sourceDescription: "Pumpkin, cooked", caveats: ["通用熟南瓜可能包含典型烹调差异；清蒸无油南瓜宜按本地数据覆盖。"]
  }),
  fndds({
    id: "winter-melon-cooked-current", name: "熟冬瓜（通用）", aliases: ["冬瓜", "煮冬瓜"],
    category: "LV", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["蔬菜", "瓜菜", "家常菜"],
    nutrientsPer100: { kcal: 36, protein: 0.4, fat: 2.74, carb: 2.95, fiber: 1 },
    fdcId: "2710004", sourceDescription: "Winter melon, cooked", caveats: ["通用熟冬瓜包含典型烹调影响；明确无油烹调时建议新增本地数据。"]
  }),
  fndds({
    id: "green-beans-raw-current", name: "四季豆", aliases: ["豆角", "菜豆", "青豆角"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", tags: ["蔬菜", "鲜豆", "家常菜"],
    nutrientsPer100: { kcal: 40, protein: 1.97, fat: 0.28, carb: 7.41, fiber: 3 },
    fdcId: "2709769", sourceDescription: "Green beans, raw", caveats: ["数据为生重；四季豆必须充分加热后食用。"]
  }),
  fndds({
    id: "bean-sprouts-raw-current", name: "豆芽", aliases: ["绿豆芽", "生豆芽"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", tags: ["蔬菜", "芽菜", "家常菜"],
    nutrientsPer100: { kcal: 30, protein: 3.04, fat: 0.18, carb: 5.94, fiber: 1.8 },
    fdcId: "2709768", sourceDescription: "Bean sprouts, raw", caveats: ["不同豆种的豆芽会有差异，记录按生重。"]
  }),
  fndds({
    id: "chives-raw-current", name: "韭菜", aliases: ["生韭菜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", tags: ["蔬菜", "深色蔬菜", "家常菜"],
    nutrientsPer100: { kcal: 30, protein: 3.27, fat: 0.73, carb: 4.35, fiber: 2.5 },
    fdcId: "2709781", sourceDescription: "Chives, raw"
  }),
  fndds({
    id: "lotus-root-cooked-current", name: "熟莲藕（通用）", aliases: ["莲藕", "藕片", "熟藕"],
    category: "LV", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["蔬菜", "根茎", "家常菜"],
    nutrientsPer100: { kcal: 87, protein: 1.54, fat: 2.61, carb: 15.5, fiber: 3 },
    fdcId: "2709936", sourceDescription: "Lotus root, cooked", caveats: ["通用熟莲藕可能包含典型烹调用油；凉拌、清煮或油炸时差异较大。"]
  }),
  fndds({
    id: "seaweed-cooked-current", name: "熟海带/海藻（未加油）", aliases: ["熟海带", "熟海藻"],
    category: "LV", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["蔬菜", "海藻", "凉菜"],
    nutrientsPer100: { kcal: 41, protein: 3.51, fat: 0.49, carb: 7.94, fiber: 0.7 },
    fdcId: "2709989", sourceDescription: "Seaweed, cooked, no added fat", caveats: ["海带、裙带菜等品种和泡发程度差异较大；不包含凉拌油。"]
  }),
  fndds({
    id: "congee-plain-current", name: "白粥（通用）", aliases: ["白米粥", "大米粥", "稀饭"],
    category: "GR", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["早餐", "粥", "主食", "熟制"],
    nutrientsPer100: { kcal: 39, protein: 0.8, fat: 0.08, carb: 8.4, fiber: 0.1 },
    fdcId: "2708418", sourceDescription: "Congee", caveats: ["稀稠程度会显著影响每100克能量；请尽量按实际熟重记录。"]
  }),
  fndds({
    id: "millet-cooked-current", name: "小米饭/稠小米粥（通用）", aliases: ["熟小米", "小米饭", "稠小米粥"],
    category: "WG", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["全谷物", "早餐", "主食"],
    nutrientsPer100: { kcal: 118, protein: 3.5, fat: 1, carb: 23.6, fiber: 1.3 },
    fdcId: "2708377", sourceDescription: "Millet", caveats: ["该值更接近熟小米或较稠成品，不适用于含水量很高的小米稀粥。"]
  }),
  fndds({
    id: "oatmeal-water-current", name: "原味燕麦粥（水冲）", aliases: ["无糖燕麦粥", "水煮燕麦粥"],
    category: "WG", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["全谷物", "早餐", "燕麦", "熟制"],
    nutrientsPer100: { kcal: 68, protein: 2.26, fat: 1.3, carb: 13.2, fiber: 1.9 },
    fdcId: "2708387", sourceDescription: "Oatmeal, instant, plain, made with water, no added fat", caveats: ["不包含牛奶、糖、坚果或水果。"]
  }),
  fndds({
    id: "soy-milk-unsweetened-current", name: "无糖豆浆（通用）", aliases: ["无糖豆奶"],
    category: "SO", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "INGREDIENT", tags: ["早餐", "豆浆", "豆制品", "饮料"],
    nutrientsPer100: { kcal: 38, protein: 3.55, fat: 2.12, carb: 1.29, fiber: 0 },
    fdcId: "2705405", sourceDescription: "Soy milk, unsweetened", caveats: [LIQUID_CAVEAT, "仅对应无糖豆浆；自制浓度、加糖量和品牌配方会改变营养值。"]
  }),
  fndds({
    id: "rice-noodles-cooked-current", name: "熟米粉/米线（通用）", aliases: ["熟米粉", "熟米线", "米制面条"],
    category: "GR", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["主食", "米粉", "米线"],
    nutrientsPer100: { kcal: 107, protein: 1.78, fat: 0.2, carb: 23.9, fiber: 1 },
    fdcId: "2708356", sourceDescription: "Rice noodles, cooked", caveats: ["仅计算熟米制面条，不包含汤、油、肉和配菜。"]
  }),
  fndds({
    id: "wonton-soup-current", name: "馄饨汤（通用）", aliases: ["云吞汤", "清汤馄饨"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["馄饨", "早餐", "外卖", "汤"],
    nutrientsPer100: { kcal: 33, protein: 2.39, fat: 1.31, carb: 2.95, fiber: 0.3 },
    fdcId: "2709160", sourceDescription: "Soup, wonton", caveats: ["馄饨数量、馅料和汤量差异很大；不拆分主食、肉类和蔬菜食物组。"]
  }),
  fndds({
    id: "chicken-thigh-roasted-current", name: "去皮熟鸡腿肉", aliases: ["烤鸡腿肉", "去皮鸡腿"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["禽肉", "鸡肉", "家常菜"],
    nutrientsPer100: { kcal: 178, protein: 24.6, fat: 8.1, carb: 0, fiber: 0 },
    fdcId: "2706030", sourceDescription: "Chicken thigh, baked, broiled, or roasted, skin not eaten, from raw", caveats: ["不包含鸡皮、裹粉、酱汁或额外用油。"]
  }),
  fndds({
    id: "duck-cooked-skinless-current", name: "去皮熟鸭肉（通用）", aliases: ["熟鸭肉", "去皮鸭肉"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["禽肉", "鸭肉", "家常菜"],
    nutrientsPer100: { kcal: 200, protein: 23.4, fat: 11.2, carb: 0, fiber: 0 },
    fdcId: "2706138", sourceDescription: "Duck, cooked, skin not eaten", caveats: ["不适用于带皮烤鸭、卤鸭或含糖酱汁的成品。"]
  }),
  fndds({
    id: "lamb-cooked-current", name: "熟羊肉（通用）", aliases: ["羊肉", "熟羊肉"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["畜肉", "羊肉", "聚餐"],
    nutrientsPer100: { kcal: 292, protein: 24.3, fat: 20.8, carb: 0, fiber: 0 },
    fdcId: "2705905", sourceDescription: "Lamb, NS as to cut", caveats: ["NS 表示部位未进一步说明；肥瘦、部位和烹调方式会显著改变结果。"]
  }),
  fndds({
    id: "pork-ribs-current", name: "熟猪排骨（通用）", aliases: ["排骨", "猪排骨"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["畜肉", "猪肉", "排骨", "聚餐"],
    nutrientsPer100: { kcal: 254, protein: 16.2, fat: 15.1, carb: 12.1, fiber: 0.3 },
    fdcId: "2705894", sourceDescription: "Pork, ribs", caveats: ["通用排骨可能包含调味或裹层；骨重、肥瘦和酱汁会造成较大差异。"]
  }),
  fndds({
    id: "tilapia-steamed-current", name: "清蒸罗非鱼", aliases: ["蒸罗非鱼", "熟罗非鱼"],
    category: "FI", compatibleStates: ["CK", "EA"], basisUnit: "g", tags: ["鱼", "水产", "家常菜"],
    nutrientsPer100: { kcal: 121, protein: 25.4, fat: 2.15, carb: 0, fiber: 0 },
    fdcId: "2706323", sourceDescription: "Fish, tilapia, steamed", caveats: ["按可食鱼肉重量记录，不包含鱼骨、浇油或酱汁。"]
  }),
  fndds({
    id: "cola-diet-current", name: "无糖可乐（通用）", aliases: ["零度可乐", "零糖可乐"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["无糖饮料", "碳酸饮料", "便利店"],
    nutrientsPer100: { kcal: 2, protein: 0.11, fat: 0.03, carb: 0.29, fiber: 0 },
    fdcId: "2710542", sourceDescription: "Soft drink, cola, diet", caveats: [LIQUID_CAVEAT, "不同甜味剂和品牌配方存在差异，包装标签优先。"]
  }),
  fndds({
    id: "sparkling-water-plain-current", name: "无糖气泡水", aliases: ["纯气泡水", "无糖苏打水"],
    category: "OT", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["无糖饮料", "气泡水", "便利店"],
    nutrientsPer100: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0 },
    fdcId: "2710539", sourceDescription: "Water, carbonated, plain", caveats: [LIQUID_CAVEAT, "仅对应不加糖的碳酸水；含糖或含果汁产品不能使用此条目。"]
  }),
  fndds({
    id: "orange-juice-100-current", name: "100%橙汁（通用）", aliases: ["纯橙汁", "百分百橙汁"],
    category: "SD", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["果汁", "饮料", "便利店"],
    nutrientsPer100: { kcal: 47, protein: 0.77, fat: 0.34, carb: 10.2, fiber: 0.3 },
    fdcId: "2709188", sourceDescription: "Orange juice, 100%, canned, bottled or in a carton", caveats: [LIQUID_CAVEAT, "果汁不计入鲜果目标；果汁饮料或加糖橙汁应另行记录。"]
  }),
  fndds({
    id: "coconut-water-unsweetened-current", name: "无糖椰子水", aliases: ["纯椰子水"],
    category: "OT", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["饮料", "椰子水", "便利店"],
    nutrientsPer100: { kcal: 18, protein: 0.22, fat: 0, carb: 4.24, fiber: 0 },
    fdcId: "2707572", sourceDescription: "Coconut water, unsweetened", caveats: [LIQUID_CAVEAT, "仅对应无糖椰子水；包装标签优先。"]
  }),
  {
    id: "coffee-unknown", name: "咖啡（配料未知）", aliases: ["咖啡"],
    category: "OT", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["咖啡", "饮料"],
    dataCaveats: ["是否含糖、牛奶、奶精或糖浆未知时只记录饮用量；确认是黑咖啡、拿铁或卡布奇诺后再选择对应条目。"],
    source: { kind: "REFERENCE", ref: "COMMON:coffee-unknown", release: "Healthier common-foods-v1" }
  },
  {
    id: "milk-tea-unknown", name: "奶茶（配方未知）", aliases: ["奶茶", "港式奶茶", "丝袜奶茶"],
    category: "SD", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["奶茶", "茶饮", "外卖"],
    dataCaveats: ["糖、奶、奶精和杯量差异很大，未固化单一营养值；请按门店信息或包装标签新增本地条目。"],
    source: { kind: "REFERENCE", ref: "CFS:RAFS-2009-BEVERAGES", release: "香港食安中心非预包装饮品研究（2009）" }
  },
  {
    id: "bubble-milk-tea-unknown", name: "珍珠奶茶（配方未知）", aliases: ["珍珠奶茶", "波霸奶茶"],
    category: "SD", compatibleStates: ["EA"], basisUnit: "ml", foodKind: "COMPOSITE", tags: ["奶茶", "珍珠", "茶饮", "外卖"],
    dataCaveats: ["珍珠、糖浆、奶和冰量使营养值波动很大；请使用门店标示或新增本地条目。"],
    source: { kind: "REFERENCE", ref: "CFS:RAFS-2009-BEVERAGES", release: "香港食安中心非预包装饮品研究（2009）" }
  },
  {
    id: "bao-bun-unknown", name: "包子（馅料未知）", aliases: ["包子"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["包子", "早餐", "面点"],
    dataCaveats: ["馅料和面皮比例未知时只记录重量，不套用肉包或素包营养值。"],
    source: { kind: "REFERENCE", ref: "COMMON:bao-unknown", release: "Healthier common-foods-v1" }
  },
  {
    id: "baijiu-unknown", name: "白酒（酒精度未知）", aliases: ["白酒"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["酒精", "白酒", "聚餐"],
    dataCaveats: ["酒精度和饮用量未知时只记录毫升数；知道约40%vol时可改选“40%vol 烈酒（通用）”。"],
    source: { kind: "REFERENCE", ref: "COMMON:baijiu-unknown", release: "Healthier common-foods-v1" }
  },
  usda({
    id: "pomelo-raw", name: "柚子（可食部）", aliases: ["柚子", "蜜柚", "沙田柚"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", tags: ["水果", "鲜果"],
    nutrientsPer100: { kcal: 38, protein: 0.76, fat: 0.04, carb: 9.62, fiber: 1 },
    fdcId: "167754", release: "USDA SR Legacy (2018)", sourceDescription: "Pummelo, raw",
    caveats: ["按去皮、去籽后的可食果肉重量记录；不同品种和成熟度会有差异。"]
  }),
  usda({
    id: "bok-choy-raw", name: "小白菜/上海青（生）", aliases: ["小白菜", "上海青", "青菜", "油菜"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", tags: ["蔬菜", "叶菜", "家常菜"],
    nutrientsPer100: { kcal: 20.3, protein: 1.02, fat: 0.234, carb: 3.51, fiber: 1.26 },
    fdcId: "2685572", release: "USDA Foundation Foods (2024-04)", sourceDescription: "Cabbage, bok choy, raw",
    caveats: ["仅对应生鲜 bok choy；熟重和不同地区俗名所指品种不能直接套用。"]
  }),
  recipe({
    id: "mantou-generic-recipe", name: "白馒头（通用配方）", aliases: ["馒头", "白馒头"],
    category: "GR", compatibleStates: ["EA"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["早餐", "主食", "面点", "发酵"],
    finalWeightG: 150,
    ingredients: [
      { name: "小麦粉", weightG: 100, nutrientsPer100: FLOUR },
      { name: "水", weightG: 49, nutrientsPer100: ZERO_NUTRIENTS },
      { name: "酵母", weightG: 1, nutrientsPer100: ZERO_NUTRIENTS }
    ],
    caveats: ["未包含糖和杂粮；含水量、大小及蒸制失水会改变结果。"]
  }),
  recipe({
    id: "youtiao-generic-recipe", name: "油条（通用配方）", aliases: ["油条", "油炸鬼"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["早餐", "面点", "油炸", "高脂"],
    finalWeightG: 150,
    ingredients: [
      { name: "小麦粉", weightG: 100, nutrientsPer100: FLOUR },
      { name: "水和膨松剂", weightG: 60, nutrientsPer100: ZERO_NUTRIENTS },
      { name: "吸附烹调油", weightG: 20, nutrientsPer100: OIL }
    ],
    caveats: ["吸油量是主要误差来源；门店油条可能明显高于或低于该值。"],
    confidence: "LOW"
  }),
  recipe({
    id: "dumpling-boiled-generic-recipe", name: "猪肉菜水饺（通用配方）", aliases: ["水饺", "煮饺子", "猪肉饺子"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["饺子", "主食", "家常菜"],
    finalWeightG: 110,
    ingredients: [
      { name: "小麦粉", weightG: 40, nutrientsPer100: FLOUR },
      { name: "猪肉", weightG: 35, nutrientsPer100: LEAN_PORK },
      { name: "白菜", weightG: 35, nutrientsPer100: CABBAGE },
      { name: "调馅油", weightG: 3, nutrientsPer100: OIL }
    ],
    caveats: ["仅代表猪肉菜馅；素馅、牛羊肉馅及肥瘦比例不同应另行记录。"],
    confidence: "LOW"
  }),
  usda({
    id: "pork-belly-raw", name: "五花肉（生）", aliases: ["生五花肉", "猪五花"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", tags: ["畜肉", "猪肉", "家常菜"],
    nutrientsPer100: { kcal: 518, protein: 9.34, fat: 53.01, carb: 0, fiber: 0 },
    fdcId: "167812", release: "USDA SR Legacy (2018)", sourceDescription: "Pork, fresh, belly, raw",
    caveats: ["肥瘦比例差异很大；仅用于生重，熟五花肉或红烧肉请改选对应条目。"]
  }),
  usda({
    id: "squid-raw", name: "鲜鱿鱼（生）", aliases: ["生鱿鱼", "鲜鱿鱼", "鱿鱼须"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", tags: ["海鲜", "水产", "聚餐"],
    nutrientsPer100: { kcal: 92, protein: 15.58, fat: 1.38, carb: 3.08, fiber: 0 },
    fdcId: "174223", release: "USDA SR Legacy (2018)", sourceDescription: "Mollusks, squid, mixed species, raw",
    caveats: ["仅对应鲜鱿鱼可食部生重；干制、裹粉油炸和调味制品不能使用此条目。"]
  }),
  fndds({
    id: "ham-sausage-generic", name: "猪肉香肠/火腿肠（通用）", aliases: ["火腿肠", "香肠", "烤肠"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["加工肉", "便利店", "聚餐"],
    nutrientsPer100: { kcal: 325, protein: 18.5, fat: 27.2, carb: 1.42, fiber: 0 },
    fdcId: "2706191", sourceDescription: "Pork sausage",
    caveats: ["这是美国通用猪肉香肠数据，中国火腿肠的肉含量、淀粉和脂肪可能差异很大，包装标签优先。"]
  }),
  fndds({
    id: "instant-noodles-prepared-generic", name: "方便面（冲泡后通用）", aliases: ["方便面", "泡面", "桶面"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "PACKAGED", tags: ["主食", "便利店", "夜宵"],
    nutrientsPer100: { kcal: 66, protein: 1.53, fat: 2.64, carb: 9.04, fiber: 0.4 },
    fdcId: "2709152", sourceDescription: "Soup, ramen noodles, water added",
    caveats: ["只适用于连汤称量的冲泡后总重；干面饼、少喝汤或不同品牌应优先按包装标签记录。"]
  }),
  {
    id: "soy-milk-unknown", name: "豆浆（糖量/浓度未知）", aliases: ["豆浆", "豆奶"],
    category: "SO", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "INGREDIENT", tags: ["早餐", "豆浆", "豆制品", "饮料"],
    dataCaveats: ["自制浓度和加糖量未知时只记录饮用量；确认无糖后可改选“无糖豆浆（通用）”。"],
    source: { kind: "REFERENCE", ref: "COMMON:soy-milk-unknown", release: COMMON_FOODS_V2 }
  },
  recipe({
    id: "tomato-scrambled-egg-generic-recipe", name: "番茄炒蛋（通用配方）", aliases: ["西红柿炒鸡蛋", "番茄炒鸡蛋"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["家常菜", "鸡蛋", "番茄"],
    finalWeightG: 250,
    ingredients: [
      { name: "鸡蛋", weightG: 100, nutrientsPer100: EGG },
      { name: "番茄", weightG: 180, nutrientsPer100: TOMATO },
      { name: "烹调油", weightG: 10, nutrientsPer100: OIL }
    ],
    caveats: ["未计入额外糖；家庭和餐馆用油量是主要误差来源。"]
  }),
  recipe({
    id: "stir-fried-greens-generic-recipe", name: "炒青菜（通用配方）", aliases: ["炒青菜", "清炒时蔬", "炒时蔬"],
    category: "LV", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["家常菜", "蔬菜", "外卖"],
    finalWeightG: 200,
    ingredients: [
      { name: "小白菜/上海青", weightG: 250, nutrientsPer100: BOK_CHOY },
      { name: "烹调油", weightG: 10, nutrientsPer100: OIL }
    ],
    caveats: ["按叶菜估算；蔬菜品种、出水量和用油量会改变结果。"],
    confidence: "LOW"
  }),
  recipe({
    id: "braised-pork-generic-recipe", name: "红烧肉（通用配方）", aliases: ["红烧肉"],
    category: "MP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["家常菜", "猪肉", "聚餐"],
    finalWeightG: 230,
    ingredients: [
      { name: "五花肉", weightG: 150, nutrientsPer100: PORK_BELLY },
      { name: "瘦猪肉", weightG: 50, nutrientsPer100: LEAN_PORK },
      { name: "糖", weightG: 10, nutrientsPer100: SUGAR },
      { name: "水和酱汁", weightG: 100, nutrientsPer100: ZERO_NUTRIENTS }
    ],
    caveats: ["肥瘦比例、糖、收汁程度和额外用油差异很大。"],
    confidence: "LOW"
  }),
  recipe({
    id: "beef-noodle-soup-generic-recipe", name: "牛肉面（通用配方）", aliases: ["牛肉面", "牛肉汤面"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["主食", "牛肉", "外卖", "汤面"],
    finalWeightG: 520,
    ingredients: [
      { name: "熟面条", weightG: 200, nutrientsPer100: COOKED_NOODLES },
      { name: "熟牛肉", weightG: 60, nutrientsPer100: COOKED_BEEF },
      { name: "小白菜", weightG: 50, nutrientsPer100: BOK_CHOY },
      { name: "辣油/香油", weightG: 8, nutrientsPer100: OIL },
      { name: "汤", weightG: 250, nutrientsPer100: ZERO_NUTRIENTS }
    ],
    caveats: ["是否喝汤、面量、牛肉量和汤面油脂会显著改变结果。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-meat-estimate", name: "组合餐肉类（估算）", aliases: ["聚餐肉类估算"],
    category: "MP", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "肉类", "熟重"],
    finalWeightG: 100,
    ingredients: [
      { name: "熟鸡肉", weightG: 50, nutrientsPer100: COOKED_CHICKEN },
      { name: "熟牛肉", weightG: 50, nutrientsPer100: COOKED_BEEF }
    ],
    caveats: ["实际肉类部位和肥瘦差异很大，不包含另加油脂。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-fish-estimate", name: "组合餐鱼虾（估算）", aliases: ["聚餐鱼虾估算"],
    category: "FI", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "鱼虾", "熟重"],
    finalWeightG: 100,
    ingredients: [
      { name: "熟三文鱼", weightG: 34, nutrientsPer100: COOKED_SALMON },
      { name: "熟鳕鱼", weightG: 33, nutrientsPer100: COOKED_COD },
      { name: "熟虾", weightG: 33, nutrientsPer100: COOKED_SHRIMP }
    ],
    caveats: ["鱼种、甲壳类比例和烹调方式差异很大，不包含裹粉、酱汁或额外用油。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-egg-estimate", name: "组合餐蛋类（估算）", aliases: ["聚餐蛋类估算"],
    category: "EG", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "蛋", "熟重"],
    finalWeightG: 100,
    ingredients: [{ name: "熟鸡蛋", weightG: 100, nutrientsPer100: EGG }],
    caveats: ["按熟全蛋可食重量估算，不包含煎炒用油、酱汁或蛋制品配料。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-vegetable-estimate", name: "组合餐蔬菜（估算）", aliases: ["聚餐蔬菜估算"],
    category: "LV", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "蔬菜", "熟重"],
    finalWeightG: 100,
    ingredients: [
      { name: "熟西兰花", weightG: 50, nutrientsPer100: COOKED_BROCCOLI },
      { name: "小白菜", weightG: 50, nutrientsPer100: BOK_CHOY }
    ],
    caveats: ["不区分深色和其他蔬菜，结构评价统一按其他蔬菜记录。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-staple-estimate", name: "组合餐主食（估算）", aliases: ["聚餐主食估算"],
    category: "GR", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "主食", "熟重"],
    finalWeightG: 100,
    ingredients: [
      { name: "熟米饭", weightG: 50, nutrientsPer100: COOKED_RICE },
      { name: "熟面条", weightG: 50, nutrientsPer100: COOKED_NOODLES }
    ],
    caveats: ["薯类、粉丝和油炸主食与该值可能差异较大。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-tuber-estimate", name: "组合餐薯类（估算）", aliases: ["聚餐薯类估算"],
    category: "TU", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "薯类", "熟重"],
    finalWeightG: 100,
    ingredients: [
      { name: "熟土豆", weightG: 50, nutrientsPer100: COOKED_POTATO },
      { name: "熟红薯", weightG: 50, nutrientsPer100: COOKED_SWEET_POTATO }
    ],
    caveats: ["按无额外用油的熟土豆与熟红薯代表值估算；炸薯条、薯粉和芋类不能套用。"],
    confidence: "LOW"
  }),
  recipe({
    id: "mixed-meal-soy-estimate", name: "组合餐豆制品（估算）", aliases: ["聚餐豆制品估算"],
    category: "SO", compatibleStates: ["CK"], basisUnit: "g", foodKind: "INGREDIENT", tags: ["组合餐估算", "豆制品", "熟重"],
    finalWeightG: 100,
    ingredients: [{ name: "豆腐和豆制品代表值", weightG: 100, nutrientsPer100: TOFU }],
    caveats: ["油豆腐、腐竹和冻豆腐与该代表值差异较大。"],
    confidence: "LOW"
  }),
  {
    id: "malatang-unknown", name: "麻辣烫（配料未知）", aliases: ["麻辣烫", "冒菜"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["外卖", "聚餐", "夜宵"],
    dataCaveats: ["食材、汤底、麻酱和用油差异极大；建议按蔬菜、肉类、豆制品、主食和汤底拆分记录。"],
    source: { kind: "REFERENCE", ref: "COMMON:malatang-unknown", release: COMMON_FOODS_V2 }
  },
  {
    id: "hotpot-unknown", name: "火锅（配料未知）", aliases: ["火锅", "涮锅"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["聚餐", "外食", "锅物"],
    dataCaveats: ["锅底、蘸料和涮菜组合无法由总重量可靠推断；建议按主要食材和蘸料拆分记录。"],
    source: { kind: "REFERENCE", ref: "COMMON:hotpot-unknown", release: COMMON_FOODS_V2 }
  },
  {
    id: "barbecue-skewers-unknown", name: "烧烤串（食材未知）", aliases: ["烧烤", "烤串", "串串"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["聚餐", "夜宵", "烧烤"],
    dataCaveats: ["肉类、蔬菜、刷油和酱料差异很大；知道食材时应分别记录。"],
    source: { kind: "REFERENCE", ref: "COMMON:barbecue-skewers-unknown", release: COMMON_FOODS_V2 }
  }
];
