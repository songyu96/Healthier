import type { FoodReference } from "./types";

const FNDDS_RELEASE = "USDA FNDDS 2021–2023 (2024-10-31)";
const FNDDS_CAVEAT = "FNDDS 通用条目采用美国膳食调查口径；实际品牌、门店配方和份量可能不同，仅用于近似记录。";
const LIQUID_CAVEAT = "FNDDS 原值按100克提供；饮品记录近似按1克≈1毫升换算。";

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
  }
];
