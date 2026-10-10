import { NUTRIENT_KEYS } from "./types";
import type { FoodReference, NutrientVector, PartialNutrientVector } from "./types";

const CHINA_FCT_DEFAULT_VERIFIED_ON = "2026-08-29";
const CHINA_FCT_CAVEAT = "中国食物成分表公开查询平台的每100克通用值；记录重量需与页面食部或成品口径一致。";

type ChinaFoodSeed = Omit<FoodReference, "source" | "dataCaveats" | "nutrientsPer100" | "partialNutrientsPer100"> & {
  pageId: string;
  energyKj: number;
  nutrients: Partial<Omit<NutrientVector, "kcal">>;
  verifiedOn?: string;
  caveats?: string[];
};

function chinaFood(seed: ChinaFoodSeed): FoodReference {
  const { pageId, energyKj, nutrients, verifiedOn = CHINA_FCT_DEFAULT_VERIFIED_ON, caveats = [], ...food } = seed;
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
      release: `中国食物成分表公开查询平台（查询于${verifiedOn}）`,
      method: "OFFICIAL_COMPOSITION"
    }
  };
}

/**
 * 中国疾控营养与健康所公开查询页中的人工核验条目。
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
  }),
  chinaFood({
    id: "china-purple-cabbage-raw", name: "紫甘蓝（生，可食部）", aliases: ["紫甘蓝", "紫包菜", "红甘蓝", "紫椰菜"],
    category: "DV", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["蔬菜", "深色蔬菜", "甘蓝", "凉拌"], pageId: "469", energyKj: 106,
    nutrients: { protein: 1.2, fat: 0.2, carb: 6.2, fiber: 3 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为86%；凉拌时额外加入的油、糖和调味料需另行记录。"]
  }),
  chinaFood({
    id: "china-shiitake-fresh-raw", name: "鲜香菇（生，可食部）", aliases: ["鲜香菇", "香菇", "冬菇", "香蕈"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "香菇", "家常食材"], pageId: "584", energyKj: 107,
    nutrients: { protein: 2.2, fat: 0.3, carb: 5.2 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为100%；这是鲜香菇生重，不适用于干香菇或烹调后重量。"]
  }),
  chinaFood({
    id: "china-shiitake-dried", name: "干香菇", aliases: ["香菇干", "干冬菇"],
    category: "LV", compatibleStates: ["RW", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "香菇", "干货"], pageId: "585", energyKj: 1149,
    nutrients: { protein: 20, fat: 1.2, carb: 61.7 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为95%；只按泡发前干重记录，泡发后重量不能直接套用。"]
  }),
  chinaFood({
    id: "china-oyster-mushroom-raw", name: "平菇（生，可食部）", aliases: ["平菇", "糙皮侧耳", "青蘑"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "平菇", "家常食材"], pageId: "581", energyKj: 101,
    nutrients: { protein: 1.9, fat: 0.3, carb: 4.6 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为93%；烹调后的失水和用油需另行处理。"]
  }),
  chinaFood({
    id: "china-enoki-mushroom-fresh-raw", name: "金针菇（鲜，生）", aliases: ["金针菇", "鲜金针菇", "智力菇"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "金针菇", "火锅"], pageId: "575", energyKj: 133,
    nutrients: { protein: 2.4, fat: 0.4, carb: 6 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为100%；火锅汤底、蘸料和吸附油脂不包含在内。"]
  }),
  chinaFood({
    id: "china-king-oyster-mushroom-raw", name: "杏鲍菇（生）", aliases: ["杏鲍菇", "刺芹侧耳"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "杏鲍菇", "家常食材"], pageId: "602", energyKj: 148,
    nutrients: { protein: 1.3, fat: 0.1, carb: 8.3 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为100%；煎炒时额外加入的油需另行记录。"]
  }),
  chinaFood({
    id: "china-black-fungus-soaked", name: "黑木耳（水发）", aliases: ["水发木耳", "泡发木耳", "云耳"],
    category: "LV", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "木耳", "泡发"], pageId: "580", energyKj: 112,
    nutrients: { protein: 1.5, fat: 0.2, carb: 6 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为100%；只用于已经泡发后的重量，不适用于干木耳重量。"]
  }),
  chinaFood({
    id: "china-tremella-dried", name: "银耳（干）", aliases: ["干银耳", "白木耳"],
    category: "LV", compatibleStates: ["RW", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["菌菇", "菌类", "银耳", "干货"], pageId: "587", energyKj: 1092,
    nutrients: { protein: 10, fat: 1.4, carb: 67.3 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为96%；只按泡发前干重记录，银耳羹还需另计糖和其他配料。"]
  }),
  chinaFood({
    id: "china-grass-carp-raw", name: "草鱼（生，可食部）", aliases: ["草鱼", "白鲩", "草包鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1003", energyKj: 475,
    nutrients: { protein: 16.6, fat: 5.2 }, verifiedOn: "2026-09-02",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；页面食部为58%。"]
  }),
  chinaFood({
    id: "china-common-carp-raw", name: "鲤鱼（生，可食部）", aliases: ["鲤鱼", "鲤拐子"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1012", energyKj: 459,
    nutrients: { protein: 17.6, fat: 4.1, carb: 0.5 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为54%；整条鱼毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-silver-carp-raw", name: "鲢鱼（生，可食部）", aliases: ["鲢鱼", "白鲢", "连子鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1020", energyKj: 436,
    nutrients: { protein: 17.8, fat: 3.6 }, verifiedOn: "2026-09-02",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；页面食部为61%。"]
  }),
  chinaFood({
    id: "china-bighead-carp-raw", name: "鳙鱼（生，可食部）", aliases: ["鳙鱼", "胖头鱼", "花鲢鱼", "大头鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1025", energyKj: 421,
    nutrients: { protein: 15.3, fat: 2.2, carb: 4.7 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为61%；鱼头等带骨毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-bream-raw", name: "鳊鱼（生，可食部）", aliases: ["鳊鱼", "鲂鱼", "武昌鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1023", energyKj: 565,
    nutrients: { protein: 18.3, fat: 6.3, carb: 1.2 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为59%；整条鱼毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-black-carp-raw", name: "青鱼（生，可食部）", aliases: ["青鱼", "青皮鱼", "青鳞鱼", "青混"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1014", energyKj: 497,
    nutrients: { protein: 20.1, fat: 4.2 }, verifiedOn: "2026-09-02",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；页面食部为63%。"]
  }),
  chinaFood({
    id: "china-spanish-mackerel-raw", name: "鲅鱼（生，可食部）", aliases: ["鲅鱼", "马鲛鱼", "燕鲅鱼", "巴鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "家常食材"], pageId: "1048", energyKj: 511,
    nutrients: { protein: 21.2, fat: 3.1, carb: 2.1 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为80%；整条鱼毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-small-yellow-croaker-raw", name: "小黄鱼（生，可食部）", aliases: ["小黄鱼", "小黄花鱼", "黄鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "家常食材"], pageId: "1038", energyKj: 417,
    nutrients: { protein: 17.9, fat: 3, carb: 0.1 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为63%；不适用于裹粉油炸的小黄鱼。"]
  }),
  chinaFood({
    id: "china-swamp-eel-raw", name: "黄鳝（生，可食部）", aliases: ["黄鳝", "鳝鱼"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "淡水鱼", "家常食材"], pageId: "1008", energyKj: 378,
    nutrients: { protein: 18, fat: 1.4, carb: 1.2 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为67%；熟制时的调味和用油需另行记录。"]
  }),
  chinaFood({
    id: "china-cod-baked", name: "鳕鱼（烤）", aliases: ["烤鳕鱼", "无油烤鳕鱼"],
    category: "FI", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "熟食", "烤制"], pageId: "1087", energyKj: 422,
    nutrients: { protein: 21.4, fat: 1.2, carb: 0.8, fiber: 0 }, verifiedOn: "2026-09-02",
    caveats: ["页面食部为85%；不包含额外刷油、裹粉或酱汁。"]
  }),
  chinaFood({
    id: "china-cod-fried", name: "鳕鱼（炸）", aliases: ["炸鳕鱼", "油炸鳕鱼", "裹粉鳕鱼"],
    category: "FI", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["鱼", "海鱼", "熟食", "油炸"], pageId: "1088", energyKj: 1032,
    nutrients: { protein: 12.4, fat: 14.3, carb: 17.4, fiber: 0.4 }, verifiedOn: "2026-09-02",
    caveats: ["这是平台中的油炸鳕鱼成品值；裹粉厚度、吸油量和品牌会显著改变结果。"]
  }),
  chinaFood({
    id: "china-mackerel-steamed", name: "鲭鱼（蒸）", aliases: ["蒸鲭鱼", "清蒸鲭鱼"],
    category: "FI", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "熟食", "蒸制"], pageId: "1081", energyKj: 1614,
    nutrients: { protein: 14.6, fat: 36.5, carb: 0.9 }, verifiedOn: "2026-09-02",
    caveats: ["平台样品脂肪值较高，只用于明确为鲭鱼的蒸制可食部；不包含另加油或酱汁。"]
  }),
  chinaFood({
    id: "china-mackerel-baked-180", name: "鲭鱼（烤，180℃约10分钟）", aliases: ["烤鲭鱼", "烤青花鱼"],
    category: "FI", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱼", "海鱼", "熟食", "烤制"], pageId: "1078", energyKj: 1520,
    nutrients: { protein: 20.2, fat: 31.8 }, verifiedOn: "2026-09-02",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；只对应页面所列180℃约10分钟样品。"]
  }),
  chinaFood({
    id: "china-dace-black-bean-cooked", name: "豆豉鲮鱼（熟）", aliases: ["豆豉鲮鱼", "罐头豆豉鲮鱼"],
    category: "FI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["鱼", "熟食", "罐头", "加工食品"], pageId: "1073", energyKj: 1963,
    nutrients: { protein: 25.5, fat: 33.1, carb: 17.9 }, verifiedOn: "2026-09-02",
    caveats: ["页面商品名为豆豉鲮鱼，食部100%；不同品牌油、糖和豆豉比例不同，包装标签优先。"]
  }),
  chinaFood({
    id: "china-cured-sausage", name: "腊肠（中国通用）", aliases: ["中式腊肠", "广式腊肠", "腊肠"],
    category: "MP", compatibleStates: ["CK", "EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["猪肉", "腌腊肉", "加工肉", "熟食"], pageId: "816", energyKj: 2421,
    nutrients: { protein: 22, fat: 48.3, carb: 15.3 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；广式、川味及不同品牌糖盐和肥瘦差异明显，包装标签优先。"]
  }),
  chinaFood({
    id: "china-pork-sausage", name: "香肠（中国通用）", aliases: ["香肠", "中式香肠", "猪肉香肠"],
    category: "MP", compatibleStates: ["CK", "EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["猪肉", "香肠", "加工肉", "熟食"], pageId: "818", energyKj: 2106,
    nutrients: { protein: 24.1, fat: 40.7, carb: 11.2 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；不能代表淀粉型火腿肠、烤肠或具体品牌，包装标签优先。"]
  }),
  chinaFood({
    id: "china-cured-pork-raw", name: "腊肉（生）", aliases: ["生腊肉", "腌腊猪肉"],
    category: "MP", compatibleStates: ["RW", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["猪肉", "腊肉", "腌腊肉", "加工肉"], pageId: "806", energyKj: 2056,
    nutrients: { protein: 11.8, fat: 48.8, carb: 2.9 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；这是烹调前产品重量，熟腊肉的失水量和肥瘦比例会改变每100克数值。"]
  }),
  chinaFood({
    id: "china-salted-pork", name: "咸肉（中国通用）", aliases: ["盐腌猪肉", "咸猪肉"],
    category: "MP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["猪肉", "咸肉", "腌腊肉", "加工肉"], pageId: "808", energyKj: 1613,
    nutrients: { protein: 16.5, fat: 36 }, verifiedOn: "2026-09-02",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；不同地区腌制和肥瘦差异明显。"]
  }),
  chinaFood({
    id: "china-ham-sausage", name: "火腿肠（中国通用）", aliases: ["火腿肠", "淀粉肠", "即食火腿肠"],
    category: "MP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["猪肉", "火腿肠", "加工肉", "便利店"], pageId: "815", energyKj: 888,
    nutrients: { protein: 14, fat: 10.4, carb: 15.6 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；不同肉含量等级、淀粉量和品牌差异明显，包装标签优先。"]
  }),
  chinaFood({
    id: "china-ham", name: "火腿（中国通用）", aliases: ["中式火腿", "熟火腿"],
    category: "MP", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["猪肉", "火腿", "腌腊肉", "加工肉"], pageId: "821", energyKj: 1369,
    nutrients: { protein: 16, fat: 27.4, carb: 4.9 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；不能代表低脂火腿片、火腿肠或具体品牌，包装标签优先。"]
  }),
  chinaFood({
    id: "china-sauced-beef", name: "酱牛肉", aliases: ["卤牛肉", "五香牛肉"],
    category: "MP", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["牛肉", "熟食", "卤味", "凉菜"], pageId: "841", energyKj: 1029,
    nutrients: { protein: 31.4, fat: 11.9, carb: 3.2 }, verifiedOn: "2026-09-02",
    caveats: ["平台通用值食部100%；卤汁糖盐、部位和含水量会改变结果，门店标签或实际配方优先。"]
  }),
  chinaFood({
    id: "china-millet-raw", name: "小米（生）", aliases: ["小米"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["小米", "全谷物", "杂粮"], pageId: "301", energyKj: 1530,
    nutrients: { protein: 9, fat: 3.1, carb: 75.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前干小米。"]
  }),
  chinaFood({
    id: "china-millet-congee", name: "小米粥", aliases: ["纯小米粥"],
    category: "WG", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["小米", "粥", "早餐", "杂粮"], pageId: "303", energyKj: 193,
    nutrients: { protein: 1.4, fat: 0.7, carb: 8.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；只对应平台的小米粥含水量，稀稠度不同会改变每100克数值。"]
  }),
  chinaFood({
    id: "china-glutinous-rice-raw", name: "糯米（生，均值）", aliases: ["糯米", "江米"],
    category: "GR", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["糯米", "江米", "谷物"], pageId: "285", energyKj: 1485,
    nutrients: { protein: 7.3, fat: 1, carb: 78.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前糯米。"]
  }),
  chinaFood({
    id: "china-yellow-cornmeal-raw", name: "黄玉米面（生）", aliases: ["玉米面", "黄玉米粉", "棒子面"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["玉米", "玉米面", "全谷物", "杂粮"], pageId: "296", energyKj: 1488,
    nutrients: { protein: 8.1, fat: 3.3, carb: 75.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹调前黄色玉米面。"]
  }),
  chinaFood({
    id: "china-oat-flakes-plain", name: "燕麦片（原味）", aliases: ["纯燕麦片", "原味燕麦片"],
    category: "WG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["燕麦", "燕麦片", "早餐", "全谷物"], pageId: "1286", energyKj: 1595,
    nutrients: { protein: 14.4, fat: 9.7, carb: 65.3, fiber: 13.2 }, verifiedOn: "2026-10-06",
    caveats: ["对应平台原味燕麦片条目；含糖、果仁或即食冲调产品应按包装标签记录。"]
  }),
  chinaFood({
    id: "china-mung-bean-dry", name: "绿豆（干）", aliases: ["干绿豆"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["绿豆", "杂豆", "干豆"], pageId: "350", energyKj: 1393,
    nutrients: { protein: 21.6, fat: 0.8, carb: 62 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前干绿豆。"]
  }),
  chinaFood({
    id: "china-adzuki-bean-dry", name: "赤小豆（干）", aliases: ["红小豆", "小豆", "干赤豆"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["赤小豆", "红小豆", "杂豆", "干豆"], pageId: "351", energyKj: 1374,
    nutrients: { protein: 20.2, fat: 0.6, carb: 63.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前干赤小豆。"]
  }),
  chinaFood({
    id: "china-black-soybean-dry", name: "黑豆（干）", aliases: ["黑大豆", "干黑豆"],
    category: "SO", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["黑豆", "大豆", "干豆"], pageId: "327", energyKj: 1680,
    nutrients: { protein: 36, fat: 15.9, carb: 33.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前黑大豆。"]
  }),
  chinaFood({
    id: "china-yellow-soybean-dry", name: "黄豆（干）", aliases: ["大豆", "干黄豆"],
    category: "SO", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["黄豆", "大豆", "干豆"], pageId: "326", energyKj: 1629,
    nutrients: { protein: 35, fat: 16, carb: 34.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前黄豆。"]
  }),
  chinaFood({
    id: "china-dry-pea", name: "豌豆（干）", aliases: ["干豌豆"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["豌豆", "杂豆", "干豆"], pageId: "368", energyKj: 1411,
    nutrients: { protein: 20.3, fat: 1.1, carb: 65.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；不能用于新鲜青豌豆。"]
  }),
  chinaFood({
    id: "china-cowpea-dry", name: "豇豆（干）", aliases: ["干豇豆"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["豇豆", "杂豆", "干豆"], pageId: "367", energyKj: 1424,
    nutrients: { protein: 19.3, fat: 1.2, carb: 65.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；不能用于新鲜长豇豆。"]
  }),
  chinaFood({
    id: "china-yuba-dry", name: "腐竹（干）", aliases: ["干腐竹", "腐皮"],
    category: "SO", compatibleStates: ["RW", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["腐竹", "豆制品", "干货"], pageId: "344", energyKj: 1931,
    nutrients: { protein: 44.6, fat: 21.7, carb: 22.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应干腐竹，泡发后的重量不能直接套用。"]
  }),
  chinaFood({
    id: "china-rapeseed-greens-raw", name: "油菜（生，可食部）", aliases: ["油菜", "青菜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["油菜", "绿叶菜", "深色蔬菜"], pageId: "457", energyKj: 104,
    nutrients: { protein: 1.8, fat: 0.5, carb: 3.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部87%。"]
  }),
  chinaFood({
    id: "china-celery-stem-raw", name: "芹菜茎（生，可食部）", aliases: ["芹菜", "芹菜茎"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["芹菜", "绿叶菜", "深色蔬菜"], pageId: "480", energyKj: 94,
    nutrients: { protein: 1.2, fat: 0.2, carb: 4.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部67%，不包括大量根叶废弃部分。"]
  }),
  chinaFood({
    id: "china-eggplant-raw", name: "茄子（生，均值）", aliases: ["茄子"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["茄子", "茄果类", "蔬菜"], pageId: "402", energyKj: 98,
    nutrients: { protein: 1.1, fat: 0.2, carb: 4.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部93%，烹调吸油需另行记录。"]
  }),
  chinaFood({
    id: "china-wax-gourd-raw", name: "冬瓜（生，可食部）", aliases: ["冬瓜"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["冬瓜", "瓜菜", "蔬菜"], pageId: "419", energyKj: 52,
    nutrients: { protein: 0.4, fat: 0.2, carb: 2.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部80%。"]
  }),
  chinaFood({
    id: "china-white-radish-raw", name: "白萝卜（生，可食部）", aliases: ["白萝卜", "莱菔"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["白萝卜", "根菜", "蔬菜"], pageId: "371", energyKj: 95,
    nutrients: { protein: 0.9, fat: 0.1, carb: 5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部95%。"]
  }),
  chinaFood({
    id: "china-lotus-root-raw", name: "莲藕（生，可食部）", aliases: ["莲藕", "藕"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["莲藕", "水生蔬菜", "根茎"], pageId: "516", energyKj: 308,
    nutrients: { protein: 1.9, fat: 0.2, carb: 16.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部88%。"]
  }),
  chinaFood({
    id: "china-bitter-melon-raw", name: "苦瓜（生，可食部）", aliases: ["苦瓜", "凉瓜", "癞瓜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["苦瓜", "瓜菜", "深色蔬菜"], pageId: "425", energyKj: 91,
    nutrients: { protein: 1, fat: 0.1, carb: 4.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部81%。"]
  }),
  chinaFood({
    id: "china-chives-raw", name: "韭菜（生，可食部）", aliases: ["韭菜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["韭菜", "葱蒜类", "深色蔬菜"], pageId: "445", energyKj: 121,
    nutrients: { protein: 2.4, fat: 0.4, carb: 4.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部90%。"]
  }),
  chinaFood({
    id: "china-pumpkin-raw", name: "南瓜（生，可食部）", aliases: ["南瓜", "倭瓜", "番瓜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["南瓜", "瓜菜", "深色蔬菜"], pageId: "426", energyKj: 99,
    nutrients: { protein: 0.7, fat: 0.1, carb: 5.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部85%。"]
  }),
  chinaFood({
    id: "china-kabocha-raw", name: "栗面南瓜（生，可食部）", aliases: ["贝贝南瓜", "板栗南瓜", "栗面南瓜"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["南瓜", "板栗南瓜", "贝贝南瓜", "深色蔬菜"], pageId: "435", energyKj: 153,
    nutrients: { protein: 1.4, fat: 0.1, carb: 8.8, fiber: 2.7 }, verifiedOn: "2026-10-06",
    caveats: ["页面条目为栗面南瓜、食部74%；不同品种甜度和含水量可能不同。"]
  }),
  chinaFood({
    id: "china-luffa-raw", name: "丝瓜（生，可食部）", aliases: ["丝瓜"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["丝瓜", "瓜菜", "蔬菜"], pageId: "429", energyKj: 90,
    nutrients: { protein: 1, fat: 0.2, carb: 4.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部83%。"]
  }),
  chinaFood({
    id: "china-zucchini-raw", name: "西葫芦（生，可食部）", aliases: ["西葫芦", "角瓜"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["西葫芦", "角瓜", "瓜菜"], pageId: "431", energyKj: 80,
    nutrients: { protein: 0.8, fat: 0.2, carb: 3.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部73%。"]
  }),
  chinaFood({
    id: "china-cowpea-fresh", name: "豇豆（鲜，可食部）", aliases: ["长豆角", "鲜豇豆"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["豇豆", "长豆角", "鲜豆", "蔬菜"], pageId: "397", energyKj: 140,
    nutrients: { protein: 2.9, fat: 0.3, carb: 5.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部97%，不能用于干豇豆。"]
  }),
  chinaFood({
    id: "china-lean-pork-raw", name: "猪瘦肉（生）", aliases: ["生猪瘦肉", "精瘦猪肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["猪肉", "瘦肉", "生肉"], pageId: "788", energyKj: 600,
    nutrients: { protein: 20.3, fat: 6.2, carb: 1.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部100%，不能用于熟猪肉。"]
  }),
  chinaFood({
    id: "china-pork-average-raw", name: "猪肉肥瘦均值（生）", aliases: ["生猪肉肥瘦", "肥瘦猪肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["猪肉", "肥瘦肉", "生肉"], pageId: "779", energyKj: 1634,
    nutrients: { protein: 13.2, fat: 37, carb: 2.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；肥瘦比例变化会显著影响脂肪和能量。"]
  }),
  chinaFood({
    id: "china-lean-beef-raw", name: "瘦牛肉（生）", aliases: ["生瘦牛肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["牛肉", "瘦肉", "生肉"], pageId: "830", energyKj: 449,
    nutrients: { protein: 20.2, fat: 2.3, carb: 1.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部100%，不能用于熟牛肉。"]
  }),
  chinaFood({
    id: "china-lean-lamb-raw", name: "瘦羊肉（生，可食部）", aliases: ["生瘦羊肉", "羊瘦肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["羊肉", "瘦肉", "生肉"], pageId: "850", energyKj: 496,
    nutrients: { protein: 20.5, fat: 3.9, carb: 0.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部90%，不能用于熟羊肉。"]
  }),
  chinaFood({
    id: "china-chicken-breast-raw", name: "鸡胸肉（生）", aliases: ["生鸡胸肉", "鸡胸脯肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鸡肉", "鸡胸肉", "生肉"], pageId: "880", energyKj: 557,
    nutrients: { protein: 19.4, fat: 5, carb: 2.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部100%，不能用于熟鸡胸肉。"]
  }),
  chinaFood({
    id: "china-chicken-leg-raw", name: "鸡腿（生，可食部）", aliases: ["生鸡腿", "带骨鸡腿"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鸡肉", "鸡腿", "生肉"], pageId: "882", energyKj: 753,
    nutrients: { protein: 16, fat: 13 }, verifiedOn: "2026-10-06",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；页面食部69%，整只带骨鸡腿毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-duck-breast-raw", name: "鸭胸肉（生）", aliases: ["生鸭胸肉", "鸭胸脯肉"],
    category: "MP", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鸭肉", "鸭胸肉", "生肉"], pageId: "892", energyKj: 379,
    nutrients: { protein: 15, fat: 1.5, carb: 4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部100%，不能用于带皮熟鸭胸。"]
  }),
  chinaFood({
    id: "china-tofu-average", name: "豆腐（中国均值）", aliases: ["普通豆腐", "水豆腐"],
    category: "SO", compatibleStates: ["EA", "CK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["豆腐", "豆制品", "大豆"], pageId: "333", energyKj: 342,
    nutrients: { protein: 8.1, fat: 3.7, carb: 4.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；这是豆腐均值，不能替代含水量不同的内酯豆腐或豆腐干。"]
  }),
  chinaFood({
    id: "china-tofu-pudding-plain", name: "豆腐脑（无卤）", aliases: ["无卤豆腐脑", "老豆腐无卤"],
    category: "SO", compatibleStates: ["EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["豆腐脑", "豆花", "早餐", "豆制品"], pageId: "337", energyKj: 62,
    nutrients: { protein: 1.9, fat: 0.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；不含卤汁、糖水或其他配料。"]
  }),
  chinaFood({
    id: "china-tofu-pudding-with-gravy", name: "豆腐脑（带卤）", aliases: ["咸豆腐脑", "带卤豆腐脑"],
    category: "SO", compatibleStates: ["EA"], basisUnit: "g", foodKind: "COMPOSITE",
    tags: ["豆腐脑", "豆花", "早餐", "小吃"], pageId: "1200", energyKj: 201,
    nutrients: { protein: 2.6, fat: 1.8, carb: 5.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；卤汁配方和用量差异会改变结果。"]
  }),
  chinaFood({
    id: "china-soy-milk-powder", name: "豆浆粉（中国通用）", aliases: ["豆奶粉", "速溶豆浆粉"],
    category: "SO", compatibleStates: ["PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["豆浆粉", "豆制品", "冲调", "早餐"], pageId: "331", energyKj: 1798,
    nutrients: { protein: 19.7, fat: 9.4, carb: 66.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于干粉，冲调后应按实际粉量记录，具体品牌标签优先。"]
  }),
  chinaFood({
    id: "china-sunflower-seeds-roasted", name: "炒葵花子（带壳食部）", aliases: ["炒瓜子", "葵花子"],
    category: "NS", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["葵花子", "瓜子", "坚果种子", "零食"], pageId: "766", energyKj: 2589,
    nutrients: { protein: 22.6, fat: 52.8, carb: 17.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部52%，记录应使用去壳后实际食用重量；盐焗产品钠含量可能不同。"]
  }),
  chinaFood({
    id: "china-pumpkin-seeds-roasted", name: "炒南瓜子（带壳食部）", aliases: ["炒白瓜子", "南瓜子"],
    category: "NS", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["南瓜子", "白瓜子", "坚果种子", "零食"], pageId: "769", energyKj: 2415,
    nutrients: { protein: 36, fat: 46.1, carb: 7.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部68%，记录应使用去壳后实际食用重量。"]
  }),
  chinaFood({
    id: "china-cashew", name: "腰果（即食）", aliases: ["腰果仁"],
    category: "NS", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["腰果", "坚果", "零食"], pageId: "756", energyKj: 2327,
    nutrients: { protein: 17.3, fat: 36.7, carb: 41.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；页面食部100%，调味或裹衣腰果应按包装标签记录。"]
  }),
  chinaFood({
    id: "china-wheat-flour-standard", name: "标准小麦粉（生）", aliases: ["标准粉", "普通面粉"],
    category: "GR", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["小麦粉", "面粉", "主食"], pageId: "259", energyKj: 1478,
    nutrients: { protein: 11.2, fat: 1.5, carb: 73.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹调前标准小麦粉，高筋、低筋和全麦粉应另行记录。"]
  }),
  chinaFood({
    id: "china-vermicelli-dry", name: "粉条（干）", aliases: ["干粉条", "粉丝干品"],
    category: "GR", compatibleStates: ["RW", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["粉条", "粉丝", "淀粉制品", "干货"], pageId: "325", energyKj: 1438,
    nutrients: { protein: 0.5, fat: 0.1, carb: 84.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应干制品，泡发或煮熟后的重量不能直接套用。"]
  }),
  chinaFood({
    id: "china-millet-flour-raw", name: "小米面（生）", aliases: ["小米粉", "粟米面"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["小米", "小米面", "杂粮", "全谷物"], pageId: "302", energyKj: 1515,
    nutrients: { protein: 7.2, fat: 2.1, carb: 77.7 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹调前小米面。"]
  }),
  chinaFood({
    id: "china-yellow-millet-raw", name: "黄小米（生）", aliases: ["黄米", "黄小米"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["黄小米", "小米", "杂粮", "全谷物"], pageId: "305", energyKj: 1488,
    nutrients: { protein: 9.7, fat: 1.5, carb: 76.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹煮前黄小米。"]
  }),
  chinaFood({
    id: "china-white-cornmeal-raw", name: "白玉米面（生）", aliases: ["白玉米粉"],
    category: "WG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["白玉米", "玉米面", "杂粮", "全谷物"], pageId: "295", energyKj: 1489,
    nutrients: { protein: 8, fat: 4.5, carb: 73.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于烹调前白玉米面。"]
  }),
  chinaFood({
    id: "china-millet-crackers", name: "小米锅巴", aliases: ["小米脆锅巴"],
    category: "GR", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["小米", "锅巴", "零食", "包装食品"], pageId: "1350", energyKj: 2350,
    nutrients: { protein: 6, fat: 36.9, carb: 54.6, fiber: 5.1 }, verifiedOn: "2026-10-06",
    caveats: ["对应平台小米锅巴通用条目；品牌配方、油脂和调味差异较大，包装标签优先。"]
  }),
  chinaFood({
    id: "china-sunflower-oil", name: "葵花籽油", aliases: ["葵花油"],
    category: "OI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["葵花籽油", "食用油", "烹调油"], pageId: "1501", energyKj: 3696,
    nutrients: { fat: 99.9, carb: 0 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出蛋白质和膳食纤维；应按实际用油重量记录。"]
  }),
  chinaFood({
    id: "china-peanut-oil", name: "花生油", aliases: [],
    category: "OI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["花生油", "食用油", "烹调油"], pageId: "1500", energyKj: 3696,
    nutrients: { fat: 99.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表碳水为Tr且未给出蛋白质、膳食纤维，应用保持未知；应按实际用油重量记录。"]
  }),
  chinaFood({
    id: "china-sesame-oil", name: "芝麻油", aliases: ["香油", "麻油"],
    category: "OI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["芝麻油", "香油", "食用油", "调味油"], pageId: "1508", energyKj: 3692,
    nutrients: { fat: 99.7, carb: 0.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出蛋白质和膳食纤维；应按实际用油重量记录。"]
  }),
  chinaFood({
    id: "china-chicken-egg-raw-average", name: "鸡蛋（生，均值）", aliases: ["生鸡蛋", "鲜鸡蛋"],
    category: "EG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鸡蛋", "蛋类", "生蛋"], pageId: "978", energyKj: 599,
    nutrients: { protein: 13.3, fat: 8.8, carb: 2.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录，不能直接用于煎蛋或炒蛋。"]
  }),
  chinaFood({
    id: "china-salted-duck-egg", name: "咸鸭蛋", aliases: ["盐鸭蛋"],
    category: "EG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["咸鸭蛋", "鸭蛋", "腌制蛋"], pageId: "995", energyKj: 793,
    nutrients: { protein: 12.7, fat: 12.7, carb: 6.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录，不同盐制程度会影响钠含量。"]
  }),
  chinaFood({
    id: "china-century-duck-egg", name: "松花蛋（鸭蛋）", aliases: ["皮蛋", "变蛋"],
    category: "EG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["松花蛋", "皮蛋", "鸭蛋", "加工蛋"], pageId: "994", energyKj: 714,
    nutrients: { protein: 14.2, fat: 10.7, carb: 4.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录。"]
  }),
  chinaFood({
    id: "china-goose-egg-raw", name: "鹅蛋（生）", aliases: ["生鹅蛋", "鲜鹅蛋"],
    category: "EG", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鹅蛋", "蛋类", "生蛋"], pageId: "997", energyKj: 814,
    nutrients: { protein: 11.1, fat: 15.6, carb: 2.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录。"]
  }),
  chinaFood({
    id: "china-salted-duck-egg-boiled", name: "咸鸭蛋（煮）", aliases: ["熟咸鸭蛋", "煮咸鸭蛋"],
    category: "EG", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["咸鸭蛋", "熟鸭蛋", "腌制蛋"], pageId: "996", energyKj: 734,
    nutrients: { protein: 13.8, fat: 13.5, carb: 0 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录。"]
  }),
  chinaFood({
    id: "china-goose-egg-boiled", name: "鹅蛋（煮）", aliases: ["熟鹅蛋", "水煮鹅蛋"],
    category: "EG", compatibleStates: ["CK", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鹅蛋", "熟蛋", "水煮蛋"], pageId: "1000", energyKj: 736,
    nutrients: { protein: 12.7, fat: 13.6, carb: 1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳可食部记录。"]
  }),
  chinaFood({
    id: "china-condensed-milk-sweetened", name: "甜炼乳", aliases: ["炼乳", "全脂甜炼乳"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["炼乳", "乳制品", "甜味配料"], pageId: "972", energyKj: 1400,
    nutrients: { protein: 8, fat: 8.7, carb: 55.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；品牌糖和脂肪含量差异较大，包装标签优先。"]
  }),
  chinaFood({
    id: "china-condensed-milk-skim-sweetened", name: "脱脂甜炼乳", aliases: ["脱脂炼乳"],
    category: "DA", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["脱脂炼乳", "乳制品", "甜味配料"], pageId: "977", energyKj: 1169,
    nutrients: { protein: 10.3, fat: 0.2, carb: 58, fiber: 0 }, verifiedOn: "2026-10-06",
    caveats: ["对应平台脱脂甜炼乳条目；具体品牌包装标签优先。"]
  }),
  chinaFood({
    id: "china-river-crab-raw", name: "河蟹（生，可食部）", aliases: ["大闸蟹", "淡水蟹"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["河蟹", "螃蟹", "水产", "甲壳类"], pageId: "1103", energyKj: 433,
    nutrients: { protein: 17.5, fat: 2.6, carb: 2.3 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅按可食部记录，整蟹毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-sea-crab-raw", name: "海蟹（生，可食部）", aliases: ["海螃蟹"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["海蟹", "螃蟹", "海鲜", "甲壳类"], pageId: "1102", energyKj: 400,
    nutrients: { protein: 13.8, fat: 2.3, carb: 4.7 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅按可食部记录，品种和肥满度会造成差异。"]
  }),
  chinaFood({
    id: "china-scallop-fresh", name: "扇贝（鲜，可食部）", aliases: ["鲜扇贝", "扇贝肉"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["扇贝", "贝类", "海鲜"], pageId: "1114", energyKj: 255,
    nutrients: { protein: 11.1, fat: 0.6, carb: 2.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按鲜可食部记录，带壳毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-scallop-dried", name: "干贝", aliases: ["瑶柱", "扇贝干"],
    category: "FI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["干贝", "瑶柱", "贝类", "干货"], pageId: "1115", energyKj: 1121,
    nutrients: { protein: 55.6, fat: 2.4, carb: 5.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应干制品，泡发后应按实际干品用量记录。"]
  }),
  chinaFood({
    id: "china-oyster-raw", name: "牡蛎（生，可食部）", aliases: ["生蚝", "海蛎子"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["牡蛎", "生蚝", "贝类", "海鲜"], pageId: "1111", energyKj: 307,
    nutrients: { protein: 5.3, fat: 2.1, carb: 8.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按可食部记录，带壳毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-squid-water-soaked", name: "水发鱿鱼", aliases: ["泡发鱿鱼"],
    category: "FI", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱿鱼", "水发", "海鲜"], pageId: "1131", energyKj: 319,
    nutrients: { protein: 17, fat: 0.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表碳水为Tr且未给出膳食纤维，应用保持未知；泡发程度会影响每100克数值。"]
  }),
  chinaFood({
    id: "china-squid-dried", name: "鱿鱼干", aliases: ["干鱿鱼"],
    category: "FI", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["鱿鱼", "海鲜", "干货"], pageId: "1130", energyKj: 1323,
    nutrients: { protein: 60, fat: 4.6, carb: 7.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应干制品，泡发或烹调后的重量不能直接套用。"]
  }),
  chinaFood({
    id: "china-clam-raw-average", name: "蛤蜊（生，均值）", aliases: ["花蛤", "蚬子", "蛤"],
    category: "FI", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["蛤蜊", "贝类", "海鲜"], pageId: "1120", energyKj: 260,
    nutrients: { protein: 10.1, fat: 1.1, carb: 2.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按可食部记录，不同蛤类和含沙含水情况会造成差异。"]
  }),
  chinaFood({
    id: "china-cassava-raw", name: "木薯（生，可食部）", aliases: ["树薯"],
    category: "TU", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["木薯", "薯类", "块根"], pageId: "319", energyKj: 505,
    nutrients: { protein: 2.1, fat: 0.3, carb: 27.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于充分去皮处理前的可食部，木薯必须正确加工熟制后食用。"]
  }),
  chinaFood({
    id: "china-water-chestnut-raw", name: "荸荠（生，可食部）", aliases: ["马蹄", "地栗"],
    category: "TU", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["荸荠", "马蹄", "水生蔬菜", "块茎"], pageId: "520", energyKj: 259,
    nutrients: { protein: 1.2, fat: 0.2, carb: 14.2 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去皮可食部记录。"]
  }),
  chinaFood({
    id: "china-taro-raw", name: "芋头（生，可食部）", aliases: ["芋艿", "毛芋"],
    category: "TU", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["芋头", "芋艿", "薯芋", "块茎"], pageId: "526", energyKj: 344,
    nutrients: { protein: 2.2, fat: 0.2, carb: 18.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去皮可食部记录，不能用于加糖芋泥。"]
  }),
  chinaFood({
    id: "china-yam-raw", name: "山药（生，可食部）", aliases: ["淮山", "薯蓣"],
    category: "TU", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["山药", "淮山", "薯芋", "块茎"], pageId: "525", energyKj: 243,
    nutrients: { protein: 1.9, fat: 0.2, carb: 12.4 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去皮可食部记录，不同山药品种含水量会有差异。"]
  }),
  chinaFood({
    id: "china-stem-lettuce-raw", name: "莴笋（生，可食部）", aliases: ["莴苣笋", "青笋"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["莴笋", "莴苣", "茎菜", "蔬菜"], pageId: "491", energyKj: 63,
    nutrients: { protein: 1, fat: 0.1, carb: 2.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去皮可食茎部记录。"]
  }),
  chinaFood({
    id: "china-lettuce-leaf-raw", name: "莴笋叶（生，可食部）", aliases: ["莴苣叶", "青笋叶"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["莴笋叶", "莴苣叶", "绿叶菜", "深色蔬菜"], pageId: "492", energyKj: 83,
    nutrients: { protein: 1.4, fat: 0.2, carb: 3.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；只适用于叶部，不应与莴笋茎混用。"]
  }),
  chinaFood({
    id: "china-kelp-fresh", name: "海带（鲜）", aliases: ["鲜海带"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["海带", "海藻", "水产蔬菜"], pageId: "605", energyKj: 55,
    nutrients: { protein: 1.2, fat: 0.1, carb: 2.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于鲜海带，不可直接用于干海带或调味海带丝。"]
  }),
  chinaFood({
    id: "china-soybean-sprouts-raw", name: "黄豆芽（生）", aliases: ["大豆芽", "生黄豆芽"],
    category: "LV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["黄豆芽", "豆芽", "蔬菜"], pageId: "399", energyKj: 199,
    nutrients: { protein: 4.5, fat: 1.6, carb: 4.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；不能替代绿豆芽，烹调油需另行记录。"]
  }),
  chinaFood({
    id: "china-nori-dried", name: "紫菜（干）", aliases: ["干紫菜", "海苔原料"],
    category: "LV", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["紫菜", "海藻", "干货"], pageId: "611", energyKj: 1050,
    nutrients: { protein: 26.7, fat: 1.1, carb: 44.1 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应干紫菜，不含烤海苔常见的油、盐和糖。"]
  }),
  chinaFood({
    id: "china-celery-leaf-raw", name: "芹菜叶（生，可食部）", aliases: ["芹叶"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["芹菜叶", "绿叶菜", "深色蔬菜"], pageId: "481", energyKj: 147,
    nutrients: { protein: 2.6, fat: 0.6, carb: 5.9 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；只适用于芹菜叶部，不应与芹菜茎混用。"]
  }),
  chinaFood({
    id: "china-water-celery-raw", name: "水芹菜（生，可食部）", aliases: ["水芹"],
    category: "DV", compatibleStates: ["RW"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["水芹", "水芹菜", "绿叶菜", "深色蔬菜"], pageId: "518", energyKj: 54,
    nutrients: { protein: 1.4, fat: 0.2, carb: 1.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于水芹，不能替代普通旱芹。"]
  }),
  chinaFood({
    id: "china-pumpkin-powder", name: "南瓜粉", aliases: ["脱水南瓜粉"],
    category: "DV", compatibleStates: ["PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["南瓜", "南瓜粉", "脱水蔬菜", "冲调"], pageId: "427", energyKj: 1448,
    nutrients: { protein: 7.1, fat: 2.1, carb: 79.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；仅适用于干粉，冲调后应按实际粉量记录，添加糖产品以包装标签为准。"]
  }),
  chinaFood({
    id: "china-pomegranate-raw", name: "石榴（生，可食部）", aliases: ["鲜石榴", "石榴籽"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["石榴", "水果", "鲜果"], pageId: "690", energyKj: 306,
    nutrients: { protein: 1.4, fat: 0.2, carb: 18.7 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按可食籽粒重量记录，整果毛重不能直接套用。"]
  }),
  chinaFood({
    id: "china-longan-fresh", name: "桂圆（鲜，可食部）", aliases: ["鲜龙眼", "龙眼"],
    category: "FR", compatibleStates: ["RW", "EA"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["桂圆", "龙眼", "水果", "鲜果"], pageId: "720", energyKj: 303,
    nutrients: { protein: 1.2, fat: 0.1, carb: 16.6 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳去核可食部记录，不能用于桂圆干。"]
  }),
  chinaFood({
    id: "china-longan-dried", name: "桂圆干", aliases: ["龙眼干", "桂圆肉"],
    category: "FR", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "INGREDIENT",
    tags: ["桂圆干", "龙眼干", "干果"], pageId: "721", energyKj: 1176,
    nutrients: { protein: 5, fat: 0.2, carb: 64.8 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；按去壳去核干果肉记录，含糖加工品应以包装标签为准。"]
  }),
  chinaFood({
    id: "china-oat-flakes-sweet-nut", name: "甜味果仁燕麦片", aliases: ["果仁燕麦片", "甜燕麦片"],
    category: "WG", compatibleStates: ["EA", "PK"], basisUnit: "g", foodKind: "PACKAGED",
    tags: ["燕麦片", "果仁", "早餐", "包装食品"], pageId: "1287", energyKj: 1749,
    nutrients: { protein: 8.9, fat: 11.1, carb: 73.5 }, verifiedOn: "2026-10-06",
    caveats: ["原表未给出膳食纤维；对应平台甜味果仁燕麦片通用条目，品牌糖、坚果和油脂配方差异较大，包装标签优先。"]
  })
];
