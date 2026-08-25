// 由 scripts/generate-food-data.mjs 从 USDA SR28 原始数据机械生成。
// 不要手工修改营养值；中文别名和分类维护在 scripts/sr28-selection.json。
import type { FoodReference } from "./types";

export const BASE_FOODS: FoodReference[] = [
  {
    "id": "rice-white-cooked",
    "name": "米饭",
    "aliases": [
      "白米饭",
      "大米饭"
    ],
    "category": "GR",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 130,
      "protein": 2.69,
      "fat": 0.28,
      "carb": 28.17,
      "fiber": 0.4
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:20045",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Rice, white, long-grain, regular, enriched, cooked"
  },
  {
    "id": "rice-brown-cooked",
    "name": "糙米饭",
    "aliases": [
      "糙米"
    ],
    "category": "WG",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 123,
      "protein": 2.74,
      "fat": 0.97,
      "carb": 25.58,
      "fiber": 1.6
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:20037",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Rice, brown, long-grain, cooked"
  },
  {
    "id": "bread-whole-wheat",
    "name": "全麦面包",
    "aliases": [
      "全麦吐司"
    ],
    "category": "WG",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 252,
      "protein": 12.45,
      "fat": 3.5,
      "carb": 42.71,
      "fiber": 6
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:18075",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Bread, whole-wheat, commercially prepared"
  },
  {
    "id": "corn-sweet-cooked",
    "name": "玉米",
    "aliases": [
      "甜玉米",
      "煮玉米"
    ],
    "category": "WG",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 96,
      "protein": 3.41,
      "fat": 1.5,
      "carb": 20.98,
      "fiber": 2.4
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11168",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Corn, sweet, yellow, cooked, boiled, drained, without salt"
  },
  {
    "id": "potato-boiled",
    "name": "土豆",
    "aliases": [
      "马铃薯",
      "煮土豆"
    ],
    "category": "TU",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 86,
      "protein": 1.71,
      "fat": 0.1,
      "carb": 20.01,
      "fiber": 1.8
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11367",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Potatoes, boiled, cooked without skin, flesh, without salt"
  },
  {
    "id": "sweet-potato-baked",
    "name": "红薯",
    "aliases": [
      "地瓜",
      "烤红薯"
    ],
    "category": "TU",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 90,
      "protein": 2.01,
      "fat": 0.15,
      "carb": 20.71,
      "fiber": 3.3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11508",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Sweet potato, cooked, baked in skin, flesh, without salt"
  },
  {
    "id": "egg-noodles-cooked",
    "name": "面条",
    "aliases": [
      "煮面条"
    ],
    "category": "GR",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 138,
      "protein": 4.54,
      "fat": 2.07,
      "carb": 25.16,
      "fiber": 1.2
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:20110",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Noodles, egg, enriched, cooked"
  },
  {
    "id": "barley-cooked",
    "name": "大麦饭",
    "aliases": [
      "熟大麦",
      "珍珠大麦"
    ],
    "category": "WG",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 123,
      "protein": 2.26,
      "fat": 0.44,
      "carb": 28.22,
      "fiber": 3.8
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:20006",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Barley, pearled, cooked"
  },
  {
    "id": "quinoa-cooked",
    "name": "藜麦饭",
    "aliases": [
      "熟藜麦",
      "藜麦"
    ],
    "category": "WG",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 120,
      "protein": 4.4,
      "fat": 1.92,
      "carb": 21.3,
      "fiber": 2.8
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:20137",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Quinoa, cooked"
  },
  {
    "id": "broccoli-cooked",
    "name": "西兰花",
    "aliases": [
      "花椰菜（绿）"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 35,
      "protein": 2.38,
      "fat": 0.41,
      "carb": 7.18,
      "fiber": 3.3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11091",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Broccoli, cooked, boiled, drained, without salt"
  },
  {
    "id": "spinach-cooked",
    "name": "菠菜",
    "aliases": [
      "熟菠菜"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 23,
      "protein": 2.97,
      "fat": 0.26,
      "carb": 3.75,
      "fiber": 2.4
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11458",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Spinach, cooked, boiled, drained, without salt"
  },
  {
    "id": "carrot-cooked",
    "name": "胡萝卜",
    "aliases": [
      "熟胡萝卜"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 35,
      "protein": 0.76,
      "fat": 0.18,
      "carb": 8.22,
      "fiber": 3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11125",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Carrots, cooked, boiled, drained, without salt"
  },
  {
    "id": "tomato-raw",
    "name": "西红柿",
    "aliases": [
      "番茄"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 18,
      "protein": 0.88,
      "fat": 0.2,
      "carb": 3.89,
      "fiber": 1.2
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11529",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Tomatoes, red, ripe, raw, year round average"
  },
  {
    "id": "cabbage-cooked",
    "name": "卷心菜",
    "aliases": [
      "圆白菜",
      "包菜"
    ],
    "category": "LV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 23,
      "protein": 1.27,
      "fat": 0.06,
      "carb": 5.51,
      "fiber": 1.9
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11110",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Cabbage, cooked, boiled, drained, without salt"
  },
  {
    "id": "cauliflower-cooked",
    "name": "菜花",
    "aliases": [
      "花椰菜",
      "白花菜"
    ],
    "category": "LV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 23,
      "protein": 1.84,
      "fat": 0.45,
      "carb": 4.11,
      "fiber": 2.3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11136",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Cauliflower, cooked, boiled, drained, without salt"
  },
  {
    "id": "mushroom-white-cooked",
    "name": "白蘑菇",
    "aliases": [
      "口蘑",
      "熟蘑菇"
    ],
    "category": "LV",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 28,
      "protein": 2.17,
      "fat": 0.47,
      "carb": 5.29,
      "fiber": 2.2
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11261",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Mushrooms, white, cooked, boiled, drained, without salt"
  },
  {
    "id": "cucumber-raw",
    "name": "黄瓜",
    "aliases": [
      "生黄瓜"
    ],
    "category": "LV",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 15,
      "protein": 0.65,
      "fat": 0.11,
      "carb": 3.63,
      "fiber": 0.5
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11205",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Cucumber, with peel, raw"
  },
  {
    "id": "pepper-red-raw",
    "name": "红甜椒",
    "aliases": [
      "红彩椒",
      "红椒"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 31,
      "protein": 0.99,
      "fat": 0.3,
      "carb": 6.03,
      "fiber": 2.1
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11821",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Peppers, sweet, red, raw"
  },
  {
    "id": "lettuce-romaine-raw",
    "name": "生菜",
    "aliases": [
      "罗马生菜"
    ],
    "category": "DV",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 17,
      "protein": 1.23,
      "fat": 0.3,
      "carb": 3.29,
      "fiber": 2.1
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:11251",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Lettuce, cos or romaine, raw"
  },
  {
    "id": "apple-raw",
    "name": "苹果",
    "aliases": [
      "带皮苹果"
    ],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 52,
      "protein": 0.26,
      "fat": 0.17,
      "carb": 13.81,
      "fiber": 2.4
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09003",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Apples, raw, with skin"
  },
  {
    "id": "banana-raw",
    "name": "香蕉",
    "aliases": [],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 89,
      "protein": 1.09,
      "fat": 0.33,
      "carb": 22.84,
      "fiber": 2.6
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09040",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Bananas, raw"
  },
  {
    "id": "orange-raw",
    "name": "橙子",
    "aliases": [
      "甜橙"
    ],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 47,
      "protein": 0.94,
      "fat": 0.12,
      "carb": 11.75,
      "fiber": 2.4
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09200",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Oranges, raw, all commercial varieties"
  },
  {
    "id": "pear-raw",
    "name": "梨",
    "aliases": [
      "鲜梨"
    ],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 57,
      "protein": 0.36,
      "fat": 0.14,
      "carb": 15.23,
      "fiber": 3.1
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09252",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Pears, raw"
  },
  {
    "id": "grapes-raw",
    "name": "葡萄",
    "aliases": [
      "红葡萄",
      "绿葡萄"
    ],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 69,
      "protein": 0.72,
      "fat": 0.16,
      "carb": 18.1,
      "fiber": 0.9
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09132",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Grapes, red or green (European type, such as Thompson seedless), raw"
  },
  {
    "id": "strawberry-raw",
    "name": "草莓",
    "aliases": [],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 32,
      "protein": 0.67,
      "fat": 0.3,
      "carb": 7.68,
      "fiber": 2
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09316",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Strawberries, raw"
  },
  {
    "id": "kiwi-raw",
    "name": "猕猴桃",
    "aliases": [
      "奇异果"
    ],
    "category": "FR",
    "basisUnit": "g",
    "compatibleStates": [
      "RW",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 61,
      "protein": 1.14,
      "fat": 0.52,
      "carb": 14.66,
      "fiber": 3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:09148",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Kiwifruit, green, raw"
  },
  {
    "id": "pork-loin-roasted",
    "name": "猪瘦肉",
    "aliases": [
      "瘦猪肉",
      "猪里脊"
    ],
    "category": "MP",
    "basisUnit": "g",
    "bookNote": "书中近似：瘦肉100克含蛋白质17～20克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 209,
      "protein": 28.62,
      "fat": 9.63,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:10027",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Pork, fresh, loin, whole, separable lean only, cooked, roasted"
  },
  {
    "id": "beef-round-roasted",
    "name": "瘦牛肉",
    "aliases": [
      "牛肉",
      "烤牛肉"
    ],
    "category": "MP",
    "basisUnit": "g",
    "bookNote": "书中近似：瘦肉100克含蛋白质17～20克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 187,
      "protein": 27.42,
      "fat": 7.72,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:13399",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Beef, round, bottom round, roast, separable lean and fat, trimmed to 0\" fat, all grades, cooked, roasted"
  },
  {
    "id": "chicken-breast-roasted",
    "name": "鸡胸肉",
    "aliases": [
      "去皮鸡胸"
    ],
    "category": "MP",
    "basisUnit": "g",
    "bookNote": "书中近似：瘦肉100克含蛋白质17～20克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 165,
      "protein": 31.02,
      "fat": 3.57,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:05064",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
  },
  {
    "id": "salmon-cooked",
    "name": "三文鱼",
    "aliases": [
      "熟三文鱼",
      "鲑鱼"
    ],
    "category": "FI",
    "basisUnit": "g",
    "bookNote": "书中近似：鱼100克含蛋白质17～20克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 182,
      "protein": 25.44,
      "fat": 8.13,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:15209",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Fish, salmon, Atlantic, wild, cooked, dry heat"
  },
  {
    "id": "cod-cooked",
    "name": "鳕鱼",
    "aliases": [
      "熟鳕鱼"
    ],
    "category": "FI",
    "basisUnit": "g",
    "bookNote": "书中近似：鱼100克含蛋白质17～20克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 105,
      "protein": 22.83,
      "fat": 0.86,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:15016",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Fish, cod, Atlantic, cooked, dry heat"
  },
  {
    "id": "shrimp-cooked",
    "name": "虾",
    "aliases": [
      "熟虾",
      "虾仁"
    ],
    "category": "FI",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 119,
      "protein": 22.78,
      "fat": 1.7,
      "carb": 1.52,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:15151",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Crustaceans, shrimp, mixed species, cooked, moist heat (may have been previously frozen)"
  },
  {
    "id": "egg-hard-boiled",
    "name": "鸡蛋",
    "aliases": [
      "水煮蛋",
      "全蛋"
    ],
    "category": "EG",
    "basisUnit": "g",
    "gramsPerPiece": 50,
    "bookNote": "书中近似：中等鸡蛋1枚约含蛋白质6～7克。",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 155,
      "protein": 12.58,
      "fat": 10.61,
      "carb": 1.12,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:01129",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Egg, whole, cooked, hard-boiled"
  },
  {
    "id": "milk-whole",
    "name": "牛奶",
    "aliases": [
      "全脂牛奶",
      "纯牛奶"
    ],
    "category": "DA",
    "basisUnit": "ml",
    "bookNote": "书中近似：牛奶100毫升约含蛋白质3克；本库按100克数据近似100毫升。",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 61,
      "protein": 3.15,
      "fat": 3.25,
      "carb": 4.8,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:01077",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Milk, whole, 3.25% milkfat, with added vitamin D"
  },
  {
    "id": "yogurt-plain",
    "name": "原味酸奶",
    "aliases": [
      "酸奶",
      "全脂酸奶"
    ],
    "category": "DA",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 61,
      "protein": 3.47,
      "fat": 3.25,
      "carb": 4.66,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:01116",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Yogurt, plain, whole milk, 8 grams protein per 8 ounce"
  },
  {
    "id": "tofu-firm",
    "name": "北豆腐",
    "aliases": [
      "硬豆腐",
      "豆腐"
    ],
    "category": "SO",
    "basisUnit": "g",
    "compatibleStates": [
      "RW"
    ],
    "nutrientsPer100": {
      "kcal": 144,
      "protein": 17.27,
      "fat": 8.72,
      "carb": 2.78,
      "fiber": 2.3
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:16426",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Tofu, raw, firm, prepared with calcium sulfate"
  },
  {
    "id": "soybeans-cooked",
    "name": "煮黄豆",
    "aliases": [
      "熟黄豆",
      "黄豆"
    ],
    "category": "SO",
    "basisUnit": "g",
    "compatibleStates": [
      "CK",
      "EA"
    ],
    "nutrientsPer100": {
      "kcal": 172,
      "protein": 18.21,
      "fat": 8.97,
      "carb": 8.36,
      "fiber": 6
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:16109",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Soybeans, mature cooked, boiled, without salt"
  },
  {
    "id": "almonds",
    "name": "杏仁",
    "aliases": [
      "巴旦木"
    ],
    "category": "NS",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 579,
      "protein": 21.15,
      "fat": 49.93,
      "carb": 21.55,
      "fiber": 12.5
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:12061",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Nuts, almonds"
  },
  {
    "id": "walnuts",
    "name": "核桃仁",
    "aliases": [
      "核桃"
    ],
    "category": "NS",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 654,
      "protein": 15.23,
      "fat": 65.21,
      "carb": 13.71,
      "fiber": 6.7
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:12155",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Nuts, walnuts, english"
  },
  {
    "id": "peanuts-raw",
    "name": "花生仁",
    "aliases": [
      "花生"
    ],
    "category": "NS",
    "basisUnit": "g",
    "compatibleStates": [
      "RW"
    ],
    "nutrientsPer100": {
      "kcal": 567,
      "protein": 25.8,
      "fat": 49.24,
      "carb": 16.13,
      "fiber": 8.5
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:16087",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Peanuts, all types, raw"
  },
  {
    "id": "olive-oil",
    "name": "橄榄油",
    "aliases": [],
    "category": "OI",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 884,
      "protein": 0,
      "fat": 100,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:04053",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Oil, olive, salad or cooking"
  },
  {
    "id": "canola-oil",
    "name": "菜籽油",
    "aliases": [
      "芥花油"
    ],
    "category": "OI",
    "basisUnit": "g",
    "compatibleStates": [
      "EA",
      "PK"
    ],
    "nutrientsPer100": {
      "kcal": 884,
      "protein": 0,
      "fat": 100,
      "carb": 0,
      "fiber": 0
    },
    "source": {
      "kind": "USDA_FDC",
      "ref": "SR28:04582",
      "release": "USDA SR28 (2015)"
    },
    "sourceDescription": "Oil, canola"
  }
];

export function mergeFoodReferences(base: FoodReference[], overrides: FoodReference[]): FoodReference[] {
  const foods = new Map(base.map((food) => [food.id, food]));
  overrides.forEach((food) => foods.set(food.id, food));
  return [...foods.values()];
}
