import { NUTRIENT_KEYS } from "./types";
import type { FoodReference, NutrientVector, PartialNutrientVector } from "./types";

const CHINA_FCT_RELEASE = "中国食物成分表公开查询平台（查询于2026-08-29）";
const CHINA_FCT_CAVEAT = "中国食物成分表公开查询平台的每100克通用值；记录重量需与页面食部或成品口径一致。";

type ChinaFoodSeed = Omit<FoodReference, "source" | "dataCaveats" | "nutrientsPer100" | "partialNutrientsPer100"> & {
  pageId: string;
  energyKj: number;
  nutrients: Partial<Omit<NutrientVector, "kcal">>;
  caveats?: string[];
};

function chinaFood(seed: ChinaFoodSeed): FoodReference {
  const { pageId, energyKj, nutrients, caveats = [], ...food } = seed;
  const vector: PartialNutrientVector = {
    kcal: Math.round(energyKj / 4.184),
    ...nutrients
  };
  const complete = NUTRIENT_KEYS.every((key) => vector[key] !== undefined);
  const missingLabels = NUTRIENT_KEYS
    .filter((key) => vector[key] === undefined)
    .map((key) => ({ kcal: "能量", protein: "蛋白质", fat: "脂肪", carb: "碳水", fiber: "膳食纤维" })[key]);
  return {
    ...food,
    ...(complete
      ? { nutrientsPer100: vector as NutrientVector }
      : { partialNutrientsPer100: vector }),
    dataCaveats: [
      CHINA_FCT_CAVEAT,
      `能量由原表 ${energyKj} kJ 按1 kcal=4.184 kJ换算并四舍五入。`,
      ...(missingLabels.length ? [`原表未给出${missingLabels.join("、")}，应用保持未知，不按0计算。`] : []),
      ...caveats
    ],
    source: {
      kind: "REFERENCE",
      ref: `https://nlc.chinanutri.cn/fq/foodinfo/${pageId}.html`,
      release: CHINA_FCT_RELEASE,
      method: "OFFICIAL_COMPOSITION"
    }
  };
}

/**
 * 中国疾控营养与健康所公开查询页中的少量人工核验条目。
 * 网页空白值不会当作 0；五项不全时保留其他已知营养素并明确标记覆盖范围。
 */
export const CHINA_FOODS: FoodReference[] = [
  chinaFood({
    id: "china-crucian-carp-raw", name: "鲫鱼（生，可食部）", aliases: ["鲫鱼", "喜头鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1021", energyKj: 455,
    nutrients: { protein: 17.1, fat: 2.7, carb: 3.8 },
    caveats: ["页面食部为54%；整条鱼毛重不能直接套用。烹调后失水和用油需另行处理。"]
  }),
  chinaFood({
    id: "china-hairtail-raw", name: "带鱼（生，可食部）", aliases: ["带鱼", "白带鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "家常食材"], pageId: "1030", energyKj: 535,
    nutrients: { protein: 17.7, fat: 4.9, carb: 3.1 },
    caveats: ["页面食部为76%；整条鱼毛重不能直接套用。烹调后失水和用油需另行处理。"]
  }),
  chinaFood({
    id: "china-perch-raw", name: "鲈鱼（生，可食部）", aliases: ["鲈鱼", "鲈花"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "海鱼", "家常食材"], pageId: "1050", energyKj: 442,
    nutrients: { protein: 18.6, fat: 3.4 },
    caveats: ["原表碳水为Tr（未检出），本应用不把Tr改写为确定的0；页面食部为58%。"]
  }),
  chinaFood({
    id: "china-pomfret-raw", name: "鲳鱼（生，可食部）", aliases: ["鲳鱼", "平鱼", "银鲳"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "家常食材"], pageId: "1056", energyKj: 585,
    nutrients: { protein: 18.5, fat: 7.3, carb: 0 },
    caveats: ["页面食部为70%；整条鱼毛重不能直接套用。烹调后失水和用油需另行处理。"]
  }),
  chinaFood({
    id: "china-duck-egg-raw", name: "鸭蛋（生，可食部）", aliases: ["生鸭蛋", "鸭蛋"],
    category: "EG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["蛋", "鸭蛋", "家常食材"], pageId: "990", energyKj: 748,
    nutrients: { protein: 12.6, fat: 13, carb: 3.1 },
    caveats: ["页面食部为87%；不适用于咸鸭蛋或皮蛋。"]
  }),
  chinaFood({
    id: "china-quail-egg-raw", name: "鹌鹑蛋（生，可食部）", aliases: ["生鹌鹑蛋", "鹌鹑蛋"],
    category: "EG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["蛋", "鹌鹑蛋", "家常食材"], pageId: "1001", energyKj: 664,
    nutrients: { protein: 12.8, fat: 11.1, carb: 2.1 },
    caveats: ["页面食部为86%；煮熟后的重量口径需重新确认。"]
  }),
  chinaFood({
    id: "china-skim-yogurt", name: "脱脂酸奶（中国通用）", aliases: ["脱脂酸奶"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["酸奶", "乳制品", "低脂", "加餐"], pageId: "959", energyKj: 241,
    nutrients: { protein: 3.3, fat: 0.4, carb: 10 },
    caveats: ["不同品牌糖含量差异明显；有包装标签时优先使用标签。"]
  }),
  chinaFood({
    id: "china-low-fat-cheese", name: "低脂奶酪（中国通用）", aliases: ["低脂芝士", "低脂奶酪"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["奶酪", "芝士", "乳制品", "加餐"], pageId: "967", energyKj: 1011,
    nutrients: { protein: 21.6, fat: 11.6, carb: 12.6, fiber: 0 },
    caveats: ["钠和配方随品牌差异较大；有包装标签时优先使用标签。"]
  }),
  chinaFood({
    id: "china-beijing-roast-duck", name: "北京烤鸭（含皮，可食部）", aliases: ["北京烤鸭", "烤鸭含皮"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["烤鸭", "鸭肉", "聚餐", "熟食"], pageId: "901", energyKj: 1805,
    nutrients: { protein: 16.6, fat: 38.4, carb: 6 },
    caveats: ["页面食部为80%，代表含皮烤鸭；不含荷叶饼、甜面酱和配菜。"]
  }),
  chinaFood({
    id: "china-prune-fresh", name: "西梅（鲜，可食部）", aliases: ["鲜西梅", "西梅"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["水果", "核果", "鲜果"], pageId: "673", energyKj: 177,
    nutrients: { protein: 0.7, fat: 0.1, carb: 10.3, fiber: 1.5 },
    caveats: ["页面食部为76%；不适用于西梅干或西梅汁。"]
  }),
  chinaFood({
    id: "china-indica-rice-dry", name: "籼米（生）", aliases: ["籼米", "长粒米"],
    category: "GR", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["大米", "主食", "生重", "谷物"], pageId: "284", energyKj: 1441,
    nutrients: { protein: 7.5, fat: 1.1, carb: 78, fiber: 5.9 },
    caveats: ["这是生米每100克数据，不能用于熟米饭重量；原表纤维值明显高于同类均值，仍按页面原值保留。"]
  }),
  chinaFood({
    id: "china-pork-chive-dumpling", name: "猪肉韭菜水饺", aliases: ["韭菜猪肉水饺", "猪肉韭菜饺子"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["饺子", "水饺", "主食", "中式快餐"], pageId: "1331", energyKj: 1068,
    nutrients: { protein: 7, fat: 14.4, carb: 26, fiber: 2.9 },
    caveats: ["仅代表猪肉韭菜馅通用条目，不能用于其他馅料或额外蘸料。"]
  }),
  chinaFood({
    id: "china-glutinous-rice-ball", name: "糯米饭团（中国通用）", aliases: ["糯米饭团", "粢饭团"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["饭团", "糯米", "早餐", "主食"], pageId: "1313", energyKj: 1393,
    nutrients: { protein: 5.9, fat: 17.6, carb: 38.3, fiber: 1.1 },
    caveats: ["饭团馅料和用油差异很大；仅在没有更准确配方时作通用参考。"]
  }),
  chinaFood({
    id: "china-eight-treasure-porridge-unsweetened", name: "无糖八宝粥（平台样品）", aliases: ["无糖八宝粥", "无糖营养八宝粥"],
    category: "WG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["八宝粥", "杂粮", "早餐", "方便食品"], pageId: "1281", energyKj: 202,
    nutrients: { protein: 1.6, fat: 0.8, carb: 9.3, fiber: 1.4 },
    caveats: ["页面商品名为娃哈哈无糖营养八宝粥；其他品牌应优先使用包装标签。"]
  }),
  chinaFood({
    id: "china-soda-sandwich-biscuit", name: "苏打夹心饼干（中国通用）", aliases: ["苏打夹心饼干"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["饼干", "夹心饼干", "零食", "方便食品"], pageId: "1327", energyKj: 1983,
    nutrients: { protein: 7.6, fat: 19.3, carb: 69.8, fiber: 5.2 },
    caveats: ["不同品牌夹心和油脂差异较大；包装标签优先。"]
  }),
  chinaFood({
    id: "china-spicy-potato-chips", name: "香辣味薯片（中国通用）", aliases: ["香辣薯片"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["薯片", "零食", "膨化食品", "聚会"], pageId: "1354", energyKj: 2350,
    nutrients: { protein: 7.4, fat: 40, carb: 46.6, fiber: 5.3 },
    caveats: ["调味和品牌差异较大；包装标签优先。"]
  }),
  chinaFood({
    id: "china-strawberry-ice-cream", name: "草莓味冰淇淋（中国通用）", aliases: ["草莓冰淇淋", "草莓雪糕"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["冰淇淋", "雪糕", "甜点", "零食"], pageId: "1394", energyKj: 641,
    nutrients: { protein: 2.7, fat: 3.2, carb: 28.5, fiber: 0.9 },
    caveats: ["不同品牌乳脂和糖含量差异较大；包装标签优先。"]
  }),
  chinaFood({
    id: "china-coca-cola-sample", name: "可口可乐（平台样品）", aliases: ["中国表可口可乐"],
    category: "SD", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED",
    tags: ["可乐", "碳酸饮料", "含糖饮料", "聚会"], beverageSugarProfile: "SUGAR_SWEETENED",
    pageId: "1367", energyKj: 184,
    nutrients: { protein: 0.1, fat: 0, carb: 10.7, fiber: 0 },
    caveats: ["原表按每100克，本条按饮料密度约1克/毫升近似为每100毫升；当前包装标签优先。"]
  }),
  chinaFood({
    id: "china-orange-drink-sample", name: "橙汁饮料（平台样品）", aliases: ["光明橙汁饮料"],
    category: "SD", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED",
    tags: ["橙汁饮料", "果汁饮料", "含糖饮料"], beverageSugarProfile: "SUGAR_SWEETENED",
    pageId: "1576", energyKj: 187,
    nutrients: { protein: 0.7, fat: 0.1, carb: 10.2, fiber: 0.2 },
    caveats: ["这是果汁饮料，不计入鲜果目标。原表按每100克，本条按密度约1克/毫升近似为每100毫升。"]
  }),
  chinaFood({
    id: "china-tsingtao-beer-43", name: "青岛啤酒4.3%（平台样品）", aliases: ["青岛啤酒4.3%"],
    category: "AL", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED",
    tags: ["啤酒", "酒精饮料", "聚会"], pageId: "1407", energyKj: 117,
    nutrients: { protein: 0.4, fat: 0, carb: 6.5, fiber: 0 },
    caveats: ["仅对应平台4.3%样品。原表按每100克，本条按密度约1克/毫升近似为每100毫升；饮酒不作健康推荐。"]
  }),
  chinaFood({
    id: "china-sanyuan-whole-milk-sample", name: "纯牛奶（三元平台样品）", aliases: ["三元纯牛奶"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "ml", foodKind: "PACKAGED",
    tags: ["牛奶", "纯牛奶", "乳制品", "早餐"], pageId: "920", energyKj: 289,
    nutrients: { protein: 3.4, fat: 3.9, carb: 5.1, fiber: 0 },
    caveats: ["原表按每100克，本条按液态奶密度近似为每100毫升；实际包装标签优先。"]
  }),
  chinaFood({
    id: "china-pork-bao", name: "猪肉包子", aliases: ["肉包子", "鲜肉包"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["包子", "早餐", "面点", "中式快餐"], pageId: "1339", energyKj: 965,
    nutrients: { protein: 7.3, fat: 10, carb: 28.6, fiber: 1.7 }
  }),
  chinaFood({
    id: "china-pork-shrimp-dumpling", name: "猪肉虾仁水饺", aliases: ["虾仁水饺", "三鲜水饺"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["饺子", "水饺", "主食", "中式快餐"], pageId: "1335", energyKj: 1116,
    nutrients: { protein: 10, fat: 15.4, carb: 22.7, fiber: 1.1 },
    caveats: ["官方条目名称为“水饺（猪肉虾仁馅）”，不能代表其他馅料水饺。"]
  }),
  chinaFood({
    id: "china-shrimp-wonton", name: "冬菜虾仁馄饨", aliases: ["虾仁馄饨"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["馄饨", "云吞", "主食", "中式快餐"], pageId: "1311", energyKj: 744,
    nutrients: { protein: 9.1, fat: 4.3, carb: 26.5, fiber: 2.3 },
    caveats: ["不适用于纯肉馅、红油或另加大量汤油的馄饨。"]
  }),
  chinaFood({
    id: "china-vegetable-spring-roll", name: "素馅春卷", aliases: ["素春卷"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["春卷", "油炸", "小吃", "聚餐"], pageId: "1219", energyKj: 797,
    nutrients: { protein: 4.9, fat: 4.6, carb: 33.8, fiber: 3.5 }
  }),
  chinaFood({
    id: "china-black-sesame-tangyuan", name: "黑芝麻汤圆", aliases: ["芝麻汤圆"],
    category: "UP", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["汤圆", "元宵", "甜点", "节日"], pageId: "1220", energyKj: 1319,
    nutrients: { protein: 4.4, fat: 13.8, carb: 44.2, fiber: 2 }
  }),
  chinaFood({
    id: "china-mooncake-red-bean", name: "豆沙月饼", aliases: ["红豆月饼"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["月饼", "豆沙", "甜点", "节日"], pageId: "1231", energyKj: 1409,
    nutrients: { protein: 5.4, fat: 6.9, carb: 64.8, fiber: 4.4 }
  }),
  chinaFood({
    id: "china-mooncake-egg-yolk", name: "蛋黄月饼", aliases: ["咸蛋黄月饼"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["月饼", "蛋黄", "甜点", "节日"], pageId: "1230", energyKj: 1682,
    nutrients: { protein: 6, fat: 20, carb: 50.2, fiber: 1.5 }
  }),
  chinaFood({
    id: "china-mooncake-chestnut", name: "桂花板栗月饼", aliases: ["板栗月饼", "栗蓉月饼"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["月饼", "板栗", "甜点", "节日"], pageId: "1232", energyKj: 1432,
    nutrients: { protein: 5.7, fat: 6.6, carb: 66.3, fiber: 4 }
  }),
  chinaFood({
    id: "china-black-sesame-powder", name: "黑芝麻糊粉", aliases: ["黑芝麻糊"],
    category: "UP", compatibleStates: ["PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["冲调", "早餐", "甜食", "方便食品"], pageId: "1283", energyKj: 1756,
    nutrients: { protein: 6.9, fat: 7.5, carb: 82.3, fiber: 4.2 },
    caveats: ["这是未冲调粉末的每100克数据；加水后的总重量不能直接套用。"]
  }),
  chinaFood({
    id: "china-fermented-glutinous-rice", name: "醪糟", aliases: ["酒酿", "甜酒酿"],
    category: "OT", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["早餐", "甜品", "发酵米制品", "小吃"], pageId: "1221", energyKj: 428,
    nutrients: { protein: 2.6, fat: 0.2, carb: 22.4, fiber: 0.5 },
    caveats: ["不包含另加鸡蛋、汤圆、糖或大量水后的整碗重量。"]
  }),
  chinaFood({
    id: "china-instant-cereal", name: "即食营养麦片（中国通用）", aliases: ["营养麦片", "冲调麦片"],
    category: "UP", compatibleStates: ["PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["早餐", "冲调", "方便食品", "麦片"], pageId: "1284", energyKj: 1708,
    nutrients: { protein: 6.5, fat: 9.7, carb: 76.3, fiber: 6.5 },
    caveats: ["官方条目脂肪和钙较高，不能当作纯燕麦片；具体品牌包装标签优先。"]
  }),
  chinaFood({
    id: "china-yogurt-with-fruit", name: "果粒酸奶（中国通用）", aliases: ["水果酸奶", "果肉酸奶"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["酸奶", "乳制品", "早餐", "加餐"], pageId: "961", energyKj: 411,
    nutrients: { protein: 3.3, fat: 2.9, carb: 14.6, fiber: 0.1 },
    caveats: ["含糖量和果粒比例随品牌变化；有包装标签时优先录入标签值。"]
  }),
  chinaFood({
    id: "china-sandwich-biscuit", name: "夹心饼干（中国通用）", aliases: ["夹心曲奇", "夹心甜饼干"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["饼干", "零食", "甜食", "方便食品"], pageId: "1325", energyKj: 1928,
    nutrients: { protein: 6.2, fat: 15.9, carb: 75.3, fiber: 5.1 },
    caveats: ["夹心种类和品牌差异较大；具体包装标签优先。"]
  }),
  chinaFood({
    id: "china-snow-rice-cracker", name: "雪米饼", aliases: ["米饼", "雪饼"],
    category: "UP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["米饼", "零食", "膨化食品", "方便食品"], pageId: "1340", energyKj: 1968,
    nutrients: { protein: 5.5, fat: 17.6, carb: 73.5, fiber: 2.9 },
    caveats: ["不同品牌的油、糖和调味量会改变结果，包装标签优先。"]
  }),
  chinaFood({
    id: "china-instant-noodles-braised-beef-dry", name: "红烧牛肉方便面（干制含调料）", aliases: ["红烧牛肉泡面", "红烧牛肉方便面"],
    category: "UP", compatibleStates: ["PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["方便面", "泡面", "夜宵", "方便食品"], pageId: "1296", energyKj: 1887,
    nutrients: { protein: 10.2, fat: 17.9, carb: 62.6, fiber: 1.4 },
    caveats: ["对应干制面饼和调味料合计的每100克数据；冲泡后加水重量不能直接套用，实际品牌标签优先。"]
  }),
  chinaFood({
    id: "china-laoqu-dry-pancake", name: "老区煎饼（干制）", aliases: ["山东干煎饼", "杂粮干煎饼"],
    category: "WG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["煎饼", "杂粮", "主食", "干制"], pageId: "1222", energyKj: 1408,
    nutrients: { protein: 9.5, fat: 3.5, carb: 70, fiber: 8.1 },
    caveats: ["官方页商品名为“老区煎饼”；这是低水分干煎饼，不能用于煎饼果子或现摊软煎饼。"]
  })
];
