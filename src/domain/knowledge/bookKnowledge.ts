export type BookKnowledgeApplicability = "HEALTHY" | "INFORMATION_ONLY" | "SAFETY_ONLY";

export interface BookSourceLocation {
  bookId: "BOOK_1" | "BOOK_2";
  bookTitle: string;
  part: string;
  chapterTitle: string;
  epubFile: string;
  tocPosition: number;
  tocTotal: number;
}

export interface BookChapterKnowledge {
  id: string;
  source: BookSourceLocation;
  summary: string;
  keyPoints: string[];
  actions: string[];
  relatedRuleIds: string[];
  applicability: BookKnowledgeApplicability;
  cautions?: string[];
}

type ChapterSeed = [
  id: string,
  part: string,
  title: string,
  file: string,
  position: number,
  summary: string,
  keyPoints: string[],
  actions: string[],
  ruleIds: string[]
];

const BOOK_1_TITLE = "《你是你吃出来的》";
const BOOK_2_TITLE = "《你是你吃出来的2：慢病康复的饮食密码》";

const BOOK_1_CHAPTERS: ChapterSeed[] = [
  ["B1-STRUCT", "PART 01", "防治慢病吃什么：35%动物类食物 + 65%植物类食物", "index_split_009.html", 8,
    "从整体食物结构出发，强调动物类和植物类食物需要搭配。",
    ["书中提出约35%动物类、65%植物类的结构参考。", "原文没有明确该比例按重量、能量还是体积计算。"],
    ["每餐先检查主食、蔬菜和蛋白质来源。", "只把35/65作为方向参考，不按克数打分。"],
    ["BR-F-008", "BR-Q-001"]],
  ["B1-DENSITY", "PART 01", "最适合现代人的食物：低能量密度，高营养密度", "index_split_018.html", 17,
    "活动量有限时，应优先选择能量较低但营养密度较高的食物。",
    ["能量密度与营养密度是两个不同维度。", "体力劳动者仍需要足够能量，不能机械追求低热量。"],
    ["优先选择蔬果、蛋奶鱼肉、豆类和少加工主食。", "结合实际活动量决定食物能量密度。"],
    ["BR-Q-005"]],
  ["B1-ENERGY", "PART 02", "能量平衡的方法因人而异", "index_split_024.html", 23,
    "按身高和活动强度估算健康成年人每日能量，并据此分配三大营养素。",
    ["标准体重按身高厘米减105估算。", "每日能量等于标准体重乘活动系数。", "健康模式采用碳水55%、蛋白质15%、脂肪30%。"],
    ["如实选择长期工作强度。", "活动长期变化时更新个人资料。"],
    ["BR-A-001", "BR-E-001", "BR-E-002", "BR-E-003", "BR-E-004", "BR-M-001"]],
  ["B1-PROTEIN", "PART 02", "蛋白质的平衡：动物类蛋白应占到蛋白总量的一半", "index_split_029.html", 28,
    "蛋白质不仅看总量，也要关注来源质量和动物、植物蛋白搭配。",
    ["书中建议动物类优质蛋白约占总蛋白一半。", "蛋奶瘦肉鱼和豆谷类分别提供动物、植物蛋白。", "可按一周观察，不要求每天精确到1克。"],
    ["在肉、鱼、蛋、奶之间轮换。", "周总结同时看总量和来源结构。"],
    ["BR-M-003", "BR-N-003"]],
  ["B1-CARB", "PART 02", "碳水化合物的平衡：每天至少要吃够150克粮食", "index_split_034.html", 33,
    "主食应与体力活动、体重和消化情况匹配，不能把所有碳水都视为糖。",
    ["谷薯杂豆是主要碳水来源。", "粗细粮比例应结合消耗和消化能力。", "交换前必须确认生熟状态和单位。"],
    ["记录薯类、粉条和淀粉小吃。", "状态不明时不做精确换算。"],
    ["BR-M-004"]],
  ["B1-FAT", "PART 02", "脂类平衡的方法：一半来自动物，另一半取自植物", "index_split_039.html", 38,
    "脂肪是身体需要的营养，重点是总量和来源搭配，不是完全取消。",
    ["健康模式脂肪约占总能量30%。", "兼顾动物性食物、植物油和坚果。", "隐藏油脂会使记录低估。"],
    ["记录油炸食品、肥肉和坚果。", "烹调油不清楚时保留未知。"],
    ["BR-M-005", "BR-N-004"]],
  ["B1-FIBER", "PART 02", "膳食纤维摄入平衡靠重视水果和蔬菜", "index_split_058.html", 57,
    "膳食纤维应主要来自多样的新鲜植物性食物。",
    ["书中成人参考量为每天25～35克。", "蔬菜、水果、全谷物和薯类是主要来源。"],
    ["优先增加不同颜色蔬菜和完整水果。", "数据未知时不把缺项当成零。"],
    ["BR-F-002", "BR-F-006"]],
  ["B1-WATER", "PART 02", "一天到底喝8杯水还是12杯水", "index_split_062.html", 61,
    "饮水量不是固定杯数，应结合气温、运动、出汗和食物含水量。",
    ["普通情况下直接饮水1200～1500毫升。", "汤粥含水与直接饮水分开记录。", "口渴和排尿只能用于自我观察。"],
    ["按实际毫升记录饮水。", "大量出汗日主动增加饮水。"],
    ["BR-F-007"]],
  ["B1-GRAIN", "PART 03", "2016版本中关于平衡膳食特征的定义：多样化，谷类为主", "index_split_068.html", 67,
    "说明谷薯类的基础地位，同时强调全谷物、杂豆、薯类和食物多样性。",
    ["谷薯每天250～400克。", "全谷杂豆50～150克，薯类50～100克。", "基础目标为每天至少12种、每周至少25种食物。"],
    ["记录具体主食名称。", "一周内轮换米面、杂粮、杂豆和薯类。"],
    ["BR-F-001", "BR-Q-002"]],
  ["B1-PLANT", "PART 03", "2016版本对蔬果、奶制品和豆制品的要求：多吃", "index_split_069.html", 68,
    "蔬菜、水果、奶和豆制品是日常结构的重要组成部分。",
    ["蔬菜每天300～500克。", "鲜果每天200～350克，果汁不能替代。", "奶制品约折合每天300克液态奶。", "豆制品强调经常吃。"],
    ["餐餐安排蔬菜，水果以完整鲜果为主。", "用周频率观察豆制品。"],
    ["BR-F-002", "BR-F-003", "BR-F-004"]],
  ["B1-ANIMAL", "PART 03", "2016版本对鱼禽蛋肉的要求：适量，不弃蛋黄", "index_split_070.html", 69,
    "鱼禽蛋肉应关注适量、轮换和加工方式。",
    ["每周鱼和畜禽肉各280～525克，蛋280～350克。", "平均每天合计约120～200克。", "优先鱼禽并轮换，少吃烟熏腌制肉。"],
    ["按周安排鱼禽肉蛋。", "重量口径不明时标记不可比较。"],
    ["BR-F-005"]],
  ["B1-BREAKFAST", "PART 03", "早餐一定要吃够100分", "index_split_076.html", 75,
    "早餐评价同时看能量和食物结构。",
    ["早餐能量约占全天1/3～1/2。", "结构包括粮食、动物性食物、蔬菜、水果和油脂。", "175厘米案例演示了蛋白质估算和早餐分配。"],
    ["先保证主食和蛋白质，再逐步补蔬果。", "同时查看能量区间和五类结构。"],
    ["BR-M-002", "BR-M-003", "BR-B-001", "BR-B-002", "BR-B-003"]],
  ["B1-LUNCH", "PART 03", "午餐请遵循“三足鼎立”原则", "index_split_077.html", 76,
    "用直观餐盘结构平衡蔬菜、蛋白质类和粮食。",
    ["蔬菜约占1/2，蛋白质和粮食各约1/4。", "这是视觉餐盘比例，不是营养素能量比。"],
    ["检查蔬菜、蛋白质和主食是否齐全。", "熟重比例只作近似观察。"],
    ["BR-L-001"]],
  ["B1-DINNER", "PART 03", "晚餐的真正价值：补足全天没吃够的营养", "index_split_078.html", 77,
    "晚餐应根据早餐和午餐的缺口补足全天结构。",
    ["优先补全天缺失食物组。", "清淡指少油少盐，不等于没有蛋白质。", "晚间活动量会影响主食需要。"],
    ["晚餐前查看今日缺口。", "优先补缺项而不是机械减量。"],
    ["BR-D-001"]],
  ["B1-MATCH", "PART 03", "没有坏食物，只有坏搭配", "index_split_080.html", 79,
    "评价饮食应先看整体搭配和频率，不因单次食物作道德化判断。",
    ["五类结构包括粮食、动物性食物、蔬菜、水果和油脂。", "偶尔摄入与长期高频摄入需要区别。"],
    ["先补齐结构，再优化单项。", "用周总结观察长期频率。"],
    ["BR-Q-001"]],
  ["B1-ROTATE", "PART 03", "同类食物多换花样更安全", "index_split_081.html", 80,
    "多样性既包括类别齐全，也包括同一类别内部轮换。",
    ["每天吃鸡肉不代表肉类已经多样。", "粮食、蔬菜、肉鱼蛋奶都可以轮换。"],
    ["一周内轮换鱼肉、蔬菜和主食。", "常用模板也定期更换食材。"],
    ["BR-Q-003"]],
  ["B1-DIVERSITY", "PART 03", "一天最好吃够30种食物", "index_split_082.html", 81,
    "作者提出积极的多样性目标，应用同时保留更基础的膳食指南目标。",
    ["基础目标为每天至少12种、每周至少25种。", "有条件时每天尽量30种。", "同一原料不同做法不重复，少量调味料不凑数。"],
    ["用一周逐步增加原料种类。", "不为凑数量加入没有实际分量的配料。"],
    ["BR-Q-002"]],
  ["B1-PROCESS", "PART 03", "食物加工越少越好", "index_split_083.html", 82,
    "同类食物中优先天然或较少加工的选择。",
    ["方便面、奶茶、薯片、腌制肉和饼干属于高加工候选。", "重点观察摄入频率和它替代了什么。"],
    ["逐步用少加工食物替换高频加工食品。", "包装食品优先录入实际标签。"],
    ["BR-Q-004"]],
  ["B1-SNACK", "PART 03", "少食多餐有门道", "index_split_084.html", 83,
    "加餐用于解决真实需要或补足缺口，并非每天必须完成。",
    ["水果、奶或酸奶、少量坚果可作加餐。", "是否需要夜宵取决于晚餐、睡眠和实际饥饿。"],
    ["优先用加餐补水果、奶或坚果缺口。", "没有需要时不强行加餐。"],
    ["BR-F-004", "BR-SN-001"]],
  ["B1-JOB", "PART 03", "工种不同，饮食有别", "index_split_093.html", 92,
    "工作活动强度影响能量消耗，久坐与重体力劳动不应采用同样安排。",
    ["久坐人群更关注低能量密度和营养密度。", "体力劳动者需要增加能量及相应营养素。"],
    ["按长期典型工作状态选择活动等级。", "工作性质明显变化时重算目标。"],
    ["BR-E-004", "BR-Q-005"]],
  ["B1-HIDDEN-CARB", "PART 04", "到底该吃多少粮食", "index_split_105.html", 104,
    "粮食摄入不只是米饭，薯类、粉条和含淀粉小吃也可能是主食来源。",
    ["主食量应结合活动和体重。", "土豆、山药、粉丝不能作为普通蔬菜漏记。", "书中多处克数未明确生熟状态。"],
    ["记录所有明显淀粉来源。", "优先选择状态明确的食物条目。"],
    ["BR-M-004"]],
  ["B1-VEG", "PART 04", "这样吃蔬菜最有营养", "index_split_114.html", 113,
    "蔬菜价值不仅取决于重量，也与颜色、部位、时令和烹饪有关。",
    ["蔬菜每天300～500克，作者倾向接近500克。", "深色蔬菜约占一半，叶菜尽量占蔬菜一半。"],
    ["每天安排深色蔬菜和叶菜。", "一周内轮换颜色和品种。"],
    ["BR-F-002"]],
  ["B1-FRUIT", "PART 04", "水果的正确“打开”方式", "index_split_121.html", 120,
    "水果以完整鲜果为主，可作正餐组成或加餐，但不能用果汁替代。",
    ["鲜果基础目标每天200～350克。", "果汁不计入鲜果目标。", "增加水果时也要考虑全天碳水。"],
    ["记录具体水果和克数。", "把果汁记录为饮品。"],
    ["BR-F-003", "BR-M-004"]]
];

function makeBook1(seed: ChapterSeed): BookChapterKnowledge {
  const [id, part, chapterTitle, epubFile, tocPosition, summary, keyPoints, actions, relatedRuleIds] = seed;
  return {
    id,
    source: { bookId: "BOOK_1", bookTitle: BOOK_1_TITLE, part, chapterTitle, epubFile, tocPosition, tocTotal: 141 },
    summary,
    keyPoints,
    actions,
    relatedRuleIds,
    applicability: "HEALTHY",
    cautions: id === "B1-ENERGY" ? ["普通成年人自查公式不是疾病治疗处方。"] : undefined
  };
}

export const BOOK_CHAPTERS: BookChapterKnowledge[] = [
  ...BOOK_1_CHAPTERS.map(makeBook1),
  {
    id: "B2-FLOW",
    source: {
      bookId: "BOOK_2",
      bookTitle: BOOK_2_TITLE,
      part: "PART 01",
      chapterTitle: "你一定要了解的营养诊疗流程",
      epubFile: "text/part0006.html",
      tocPosition: 7,
      tocTotal: 226
    },
    summary: "强调完整评估、问题排序、可执行干预、监测和重新评估，而不是仅凭身高体重给出统一食谱。",
    keyPoints: ["管理是评估、识别问题、干预、监测和再评估的循环。", "一次优先处理少数关键问题。", "半定量记录可使用范围和周趋势。", "油脂等无法确认的数据应保留未知。"],
    actions: ["先连续记录，再从周总结选择1～3个行动。", "每周复盘行动是否可执行。"],
    relatedRuleIds: ["BR-A-001", "BR-A-002", "BR-N-001", "BR-N-002", "BR-N-003", "BR-N-004"],
    applicability: "SAFETY_ONLY",
    cautions: ["第二册疾病案例不进入健康成年人自动计算。", "确诊疾病、用药、孕产期或异常指标需要专业评估。"]
  }
];

export function bookProgressPercent(source: BookSourceLocation): number {
  return Math.round((source.tocPosition / source.tocTotal) * 100);
}

export function bookLocationLabel(source: BookSourceLocation): string {
  return `${source.bookTitle} · ${source.part} · EPUB目录第 ${source.tocPosition}/${source.tocTotal} 项 · 约全书 ${bookProgressPercent(source)}% 位置`;
}

export function findBookChapter(id: string): BookChapterKnowledge | undefined {
  return BOOK_CHAPTERS.find((chapter) => chapter.id === id);
}

export function chaptersForRule(ruleId: string): BookChapterKnowledge[] {
  return BOOK_CHAPTERS.filter((chapter) => chapter.relatedRuleIds.includes(ruleId));
}
