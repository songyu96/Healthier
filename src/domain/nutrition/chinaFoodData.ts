import type { FoodReference, NutrientVector } from "./types";

const CHINA_FCT_RELEASE = "中国食物成分表公开查询平台（查询于2026-08-28）";
const CHINA_FCT_CAVEAT = "中国食物成分表中的通用成品值；馅料、配方、品牌和制作方式不同会造成差异。";

type ChinaFoodSeed = Omit<FoodReference, "source" | "dataCaveats" | "nutrientsPer100"> & {
  pageId: string;
  energyKj: number;
  nutrients: Omit<NutrientVector, "kcal">;
  caveats?: string[];
};

function chinaFood(seed: ChinaFoodSeed): FoodReference {
  const { pageId, energyKj, nutrients, caveats = [], ...food } = seed;
  return {
    ...food,
    nutrientsPer100: {
      kcal: Math.round(energyKj / 4.184),
      ...nutrients
    },
    dataCaveats: [
      CHINA_FCT_CAVEAT,
      `能量由原表 ${energyKj} kJ 按1 kcal=4.184 kJ换算并四舍五入。`,
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
 * 仅收录五项营养值均明确给出的食品；网页空白值不会当作 0。
 */
export const CHINA_FOODS: FoodReference[] = [
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
  })
];
