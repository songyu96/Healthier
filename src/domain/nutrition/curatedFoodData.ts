import type { FoodReference } from "./types";

const FNDDS_RELEASE = "USDA FNDDS 2017–2018";
const GENERIC_CAVEAT = "FNDDS 通用条目采用美国膳食调查口径；实际品牌、配方和份量可能明显不同，仅用于近似记录。";

export const FNDDS_FOODS: FoodReference[] = [
  {
    id: "cheeseburger-nfs", name: "芝士汉堡（通用）", aliases: ["奶酪汉堡"], category: "UP",
    compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["汉堡", "快餐", "组合成品"],
    nutrientsPer100: { kcal: 297, protein: 17.92, fat: 16.21, carb: 18.62, fiber: 0.6 },
    dataCaveats: [GENERIC_CAVEAT, "NFS 表示原调查记录未进一步说明具体配方。"],
    source: { kind: "USDA_FDC", ref: "FDC:1099759", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Cheeseburger, NFS"
  },
  {
    id: "pizza-cheese-frozen-thin", name: "冷冻薄底芝士披萨", aliases: ["冷冻芝士披萨", "冷冻奶酪披萨"], category: "UP",
    compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["披萨", "冷冻食品", "包装食品"],
    nutrientsPer100: { kcal: 263, protein: 11.91, fat: 11.07, carb: 28.8, fiber: 3 },
    dataCaveats: [GENERIC_CAVEAT, "数据对应加热后食用的冷冻薄底芝士披萨；具体包装标签优先。"],
    source: { kind: "USDA_FDC", ref: "FDC:1101968", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Pizza, cheese, from frozen, thin crust"
  },
  {
    id: "dumpling-steamed-meat-nfs", name: "蒸肉馅饺子（通用）", aliases: ["蒸饺", "肉馅蒸饺"], category: "OT",
    compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["饺子", "蒸制", "组合成品"],
    nutrientsPer100: { kcal: 113, protein: 6.9, fat: 4.6, carb: 11.07, fiber: 1.2 },
    dataCaveats: [GENERIC_CAVEAT, "馅料可能为肉、禽或海鲜；需要准确食物组评价时请拆分原料记录。"],
    source: { kind: "USDA_FDC", ref: "FDC:1102065", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Dumpling, steamed, filled with meat, poultry, or seafood"
  },
  {
    id: "dumpling-vegetable", name: "素馅饺子", aliases: ["素菜饺子", "素饺"], category: "OT",
    compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["饺子", "素食", "组合成品"],
    nutrientsPer100: { kcal: 163, protein: 5.15, fat: 3.83, carb: 26.75, fiber: 1.5 },
    dataCaveats: [GENERIC_CAVEAT, "不拆分面皮和馅料，不能据此判断蔬菜或主食是否达标。"],
    source: { kind: "USDA_FDC", ref: "FDC:1102085", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Dumpling, vegetable"
  },
  {
    id: "egg-roll-beef-pork", name: "牛肉或猪肉春卷", aliases: ["肉春卷"], category: "OT",
    compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["春卷", "油炸", "组合成品"],
    nutrientsPer100: { kcal: 277, protein: 9.39, fat: 14.33, carb: 27.87, fiber: 2 },
    dataCaveats: [GENERIC_CAVEAT, "英文原条目为 egg roll，不等同于甜味蛋卷。"],
    source: { kind: "USDA_FDC", ref: "FDC:1102058", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Egg roll, with beef and/or pork"
  },
  {
    id: "sushi-california-roll", name: "加州卷寿司", aliases: ["加州卷"], category: "OT",
    compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE", tags: ["寿司", "米饭", "组合成品"],
    nutrientsPer100: { kcal: 93, protein: 2.92, fat: 0.67, carb: 18.41, fiber: 1 },
    dataCaveats: [GENERIC_CAVEAT, "不同门店的米饭、馅料和酱料差异较大。"],
    source: { kind: "USDA_FDC", ref: "FDC:1102346", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Sushi roll, California"
  },
  {
    id: "potato-chips-plain", name: "原味薯片", aliases: ["普通薯片"], category: "UP",
    compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["零食", "薯片", "包装食品"],
    nutrientsPer100: { kcal: 532, protein: 6.39, fat: 33.98, carb: 53.83, fiber: 3.1 },
    dataCaveats: [GENERIC_CAVEAT, "不同品牌和口味差异较大，手边有包装时请录入标签值。"],
    source: { kind: "USDA_FDC", ref: "FDC:1102919", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Potato chips, plain"
  },
  {
    id: "cereal-corn-flakes", name: "玉米片早餐谷物", aliases: ["早餐玉米片", "玉米脆片"], category: "UP",
    compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["早餐谷物", "玉米片", "包装食品"],
    nutrientsPer100: { kcal: 357, protein: 7.5, fat: 0.4, carb: 84.1, fiber: 3.3 },
    dataCaveats: [GENERIC_CAVEAT, "不包含另加的牛奶；具体品牌标签优先。"],
    source: { kind: "USDA_FDC", ref: "FDC:1101716", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Cereal, corn flakes"
  },
  {
    id: "cereal-granola-bar-nfs", name: "谷物棒（通用）", aliases: ["燕麦棒", "早餐谷物棒"], category: "UP",
    compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["零食", "谷物棒", "包装食品"],
    nutrientsPer100: { kcal: 471, protein: 10.1, fat: 19.8, carb: 64.4, fiber: 5.3 },
    dataCaveats: [GENERIC_CAVEAT, "NFS 表示未进一步说明具体类型；不同产品差异很大，包装标签优先。"],
    source: { kind: "USDA_FDC", ref: "FDC:1101243", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Cereal or Granola bar, NFS"
  },
  {
    id: "soft-drink-cola", name: "含糖可乐", aliases: ["普通可乐", "可乐"], category: "SD",
    compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED", tags: ["含糖饮料", "碳酸饮料", "包装食品"],
    nutrientsPer100: { kcal: 42, protein: 0, fat: 0.25, carb: 10.36, fiber: 0 },
    dataCaveats: [GENERIC_CAVEAT, "FNDDS 原值按100克提供；记录时近似按1克≈1毫升换算，具体包装标签优先。"],
    source: { kind: "USDA_FDC", ref: "FDC:1104310", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Soft drink, cola"
  },
  {
    id: "yogurt-lowfat-nonfruit-flavored", name: "低脂风味酸奶（非水果）", aliases: ["低脂风味酸奶"], category: "DA",
    compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED", tags: ["酸奶", "低脂", "包装食品"],
    nutrientsPer100: { kcal: 73, protein: 5.09, fat: 1.51, carb: 9.82, fiber: 0 },
    dataCaveats: [GENERIC_CAVEAT, "对应非水果风味低脂酸奶；水果味、无糖或高蛋白产品应使用各自标签。"],
    source: { kind: "USDA_FDC", ref: "FDC:1097575", release: FNDDS_RELEASE, method: "OFFICIAL_COMPOSITION" },
    sourceDescription: "Yogurt, low fat milk, flavors other than fruit"
  }
];
