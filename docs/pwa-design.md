# 书本规则驱动的 PWA 设计

版本：0.1  
依赖规格：`docs/book-rules-spec.md` 0.1

## 1. 产品目标

这是一个私人、移动端优先、离线可用的健康饮食助手：

1. 用户在 ChatGPT 中上传餐食照片。
2. ChatGPT 只输出一行标准字符串。
3. 用户复制到 PWA。
4. PWA 解析、让用户校正、保存到 IndexedDB。
5. PWA 按两本书的规则计算每日目标、识别缺口、给出下一餐和一周调整建议。

ChatGPT 不直接写数据库，也不输出 JSON。JSON/对象只存在于 PWA 内部实现中。

## 2. 功能边界

### v1 包含

- 个人健康档案与活动强度选择。
- 书本能量和宏量营养素计算器。
- 一行字符串导入与人工校正。
- 早餐评分、午餐结构近似、晚餐补缺。
- 每日食物组、饮水、多样性、加工度分析。
- 一周平衡、食物轮换、身体趋势。
- 本地加密备份与恢复。
- 安全提示和特殊情况降级。

### v1 不包含

- 疾病治疗食谱、药物调整和化验单诊断。
- 自动上传餐食照片或保存原图。
- 付费模型 API、后台服务器和多人账号。
- 未经用户确认的精确油盐估计。

## 3. 一行导入协议

### 3.1 基本格式

```text
HD1|YYYYMMDD-HHmm|餐次|食物项;食物项|烹饪方式|备注
```

食物项：

```text
名称~分类~状态~最小值-最大值单位
```

示例：

```text
HD1|20260824-1230|L|米饭~GR~CK~120-180g;西兰花~DV~CK~80-120g;鸡胸肉~MP~CK~60-90g|STIRFRY|油盐未知
```

### 3.2 字段枚举

餐次：

| 代码 | 含义 |
|---|---|
| `B` | 早餐 |
| `L` | 午餐 |
| `D` | 晚餐 |
| `S` | 加餐/夜宵 |

食物分类：

| 代码 | 含义 |
|---|---|
| `GR` | 普通谷物/精制主食 |
| `WG` | 全谷物/杂豆 |
| `TU` | 薯类及淀粉性根茎 |
| `DV` | 深色蔬菜 |
| `LV` | 其他蔬菜 |
| `FR` | 新鲜水果 |
| `FI` | 鱼虾海产 |
| `MP` | 畜禽肉 |
| `EG` | 蛋 |
| `DA` | 奶及奶制品 |
| `SO` | 大豆及豆制品 |
| `NS` | 坚果和种子 |
| `OI` | 烹调油/显性脂肪 |
| `SD` | 饮料（非奶/豆/酒）；糖状态由独立字段记录 |
| `AL` | 酒精饮品 |
| `UP` | 高加工食品 |
| `OT` | 其他/待确认 |

状态：

| 代码 | 含义 |
|---|---|
| `RW` | 生重/原料重 |
| `CK` | 熟重 |
| `EA` | 即食状态 |
| `PK` | 包装标示量 |
| `UN` | 状态未知 |

单位支持 `g`、`ml`、`pc`。模型应优先输出克或毫升；无法可靠换算时保留件数并要求用户确认。

### 3.3 语法约束

- 固定前缀 `HD1` 用于协议版本识别。
- `|`、`;`、`~` 是保留分隔符，食物名和备注中不得出现；必要时替换为全角字符。
- 数量必须是范围。即使看起来确定，也输出如 `100-100g`。
- 混合菜拆成可见的主要原料；不可见的油盐放入备注，不伪造克数。
- 字符串按 UTF-8 处理，时间按用户本地时区解释。
- 导入失败时保留原字符串并指出具体字段，不丢弃用户输入。

## 4. 本地数据结构

内部结构建议使用 TypeScript 类型和 IndexedDB。所有量值同时保存最小值和最大值。

### 4.1 `UserProfile`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 本地唯一标识 |
| `birthYear` | number? | 年龄提示，不自动套年龄折扣 |
| `sex` | enum? | 用于腰围等提示，不影响书中标准体重公式 |
| `heightCm` | number | 身高 |
| `currentWeightKg` | number | 当前体重 |
| `waistCm` | number? | 身体趋势资料 |
| `activityLevel` | enum | `BEDRIDDEN/LIGHT/MODERATE/HEAVY` |
| `overweightAdjustmentEnabled` | boolean | 是否主动采用25系数 |
| `regularExercise` | text | 项目、频率、时长，供活动等级复核 |
| `dietConstraints` | string[] | 忌口、过敏、预算、烹饪条件 |
| `healthFlags` | string[] | 疾病、用药、孕产等安全门信息 |
| `goal` | enum | 维持、改善结构等；v1不自动制定医学减重速度 |
| `ruleSetVersion` | string | 计算所用书本规则版本 |

### 4.2 `BodyMetric`

```text
id, profileId, measuredAt,
weightKg, waistCm?, sleepHours?, subjectiveEnergy?, note?
```

用于第二册所说的监测—评价闭环。主观精力只作趋势记录，不作疾病判断。

### 4.3 `MealRecord`

| 字段 | 说明 |
|---|---|
| `id` | 本地唯一标识 |
| `eatenAt` | 就餐时间 |
| `mealType` | B/L/D/S |
| `rawImportLine` | 原始一行字符串，永不覆盖 |
| `protocolVersion` | `HD1` |
| `cookingMethod` | 烹饪方式 |
| `note` | 原备注 |
| `unknownOil` / `unknownSalt` | 是否未知 |
| `estimateSource` | GPT照片估算、用户手工、称重 |
| `confidence` | 用户确认前后状态，不生成伪概率 |
| `ruleSetVersion` | 当时使用的规则版本 |

### 4.4 `MealItem`

```text
id, mealId,
displayName, canonicalFoodId?, category,
foodState, quantityMin, quantityMax, unit,
edibleQuantityMin?, edibleQuantityMax?,
sourceText, userConfirmed,
processingLevel?, conversionRuleId?
```

关键原则：观察到的熟重/即食重量与换算后的参考重量分开保存，不能覆盖原估计。

### 4.5 `FoodReference`

```text
canonicalFoodId, canonicalName, aliases,
category, referenceState,
kcalPer100, proteinPer100, fatPer100, carbPer100, fiberPer100?,
yieldConversions[], bookEquivalences[],
compositionSource, sourceVersion
```

书中只给出少量食物近似值，完整营养计算需要辅助食物成分表。辅助数据只负责“这份食物大约含多少营养”，不负责决定目标比例。

### 4.6 `RuleDefinition`

```text
ruleId, version, name, sourceRef, evidenceType,
parameters, enabled, effectiveFrom, notes
```

例如 `BR-E-002` 保存四档活动系数；`BR-M-001` 保存55/15/30。

### 4.7 `DailyAssessment`

```text
date, targetSnapshot,
intakeRange, groupRange, waterMl,
breakfastScoreRange?, lunchPlateApprox?,
foodVarietyCount, processingFlags,
gaps[], safetyFlags[], generatedAt
```

`targetSnapshot` 保存当天实际使用的目标，避免未来规则升级后历史结果无声改变。

### 4.8 `WeeklyAssessment`

```text
weekStart, validDays,
averageIntakeRange, targetHitDays,
weeklyAnimalFoods, uniqueFoodCount,
rotationSummary, bodyTrend,
priorityProblems[], nextWeekActions[], ruleSetVersion
```

### 4.9 `InterventionPlan`

```text
id, createdAt, periodStart, periodEnd,
priority, problemCode, actionText,
bookRuleIds[], status, userFeedback?
```

一次只保留1～3条主要行动，对应第二册“一人一方、问题排序”的方法。

## 5. 计算器设计

### 5.1 个人目标计算器

```text
standardWeightKg = heightCm - 105
factor = activityLevel 对应 25/30/35/40

若 activityLevel=LIGHT 且用户主动开启超重调整：
factor = 25

energyKcal = standardWeightKg × factor
carbG = energyKcal × 0.55 ÷ 4
proteinG = energyKcal × 0.15 ÷ 4
fatG = energyKcal × 0.30 ÷ 9
animalProteinG = proteinG ÷ 2
plantProteinG = proteinG ÷ 2
proteinCrossCheck = standardWeightKg × [1.0, 1.2]
breakfastEnergy = [energyKcal/3, energyKcal/2]
```

输出必须同时显示：公式、输入、结果、规则出处和当前规则版本。

### 5.2 食物标准化

1. 解析 `MealItem`。
2. 用别名表匹配 `canonicalFoodId`。
3. 按食物状态选择同状态成分数据；只有存在明确转换规则时才作熟生换算。
4. 用区间算术计算营养素范围。
5. 油盐未知时挂起提醒，不填确定值。

```text
nutrientMin = quantityMin × nutrientPer100 / 100
nutrientMax = quantityMax × nutrientPer100 / 100
```

若数量和成分值本身都有范围，使用区间端点计算并保留来源。

### 5.3 早餐评分

```text
energyScoreMin = clamp(50 × breakfastEnergyMin / (dailyEnergy/3), 0, 50)
energyScoreMax = clamp(50 × breakfastEnergyMax / (dailyEnergy/3), 0, 50)
structureScore = 已出现的五大类数量 × 10
totalScoreRange = [energyScoreMin + structureScore, energyScoreMax + structureScore]
```

- 同时用摄入上下限计算评分范围，界面可显示如 `72～86分`。
- 果汁分类为 `SD`，不计入 `FR`；奶计动物类，坚果计油脂类。
- 能量线性折算是产品推导，不能标记为书中原公式。

### 5.4 午餐结构

午餐目标是蔬菜1/2、蛋白质食物1/4、粮食1/4。因为照片和熟重无法准确还原餐盘面积，v1采用两层评价：

1. **类别完整性**：蔬菜、蛋白质、粮食是否都出现。
2. **熟重近似比例**：按三组可食熟重估算，并明确标为“近似”，不计入总健康分。

活动量大时只提示“可适当增加粮食”，不自动发明新的比例。

### 5.5 晚餐补缺

计算当天早餐和午餐后的缺口：

- 缺失的五大类。
- 蔬菜、鲜果、奶、鱼禽蛋肉和饮水距离书中目标的区间。
- 当日蛋白质、碳水、脂肪区间。
- 食物种类和同类轮换。

晚餐推荐优先补缺，并遵守：少油少盐、保留蛋白质、无晚间运动时不优先追加大量主食。

### 5.6 每周平衡

- 蛋白质和食物组同时展示日均与7天累计。
- 鱼、畜禽、蛋按书中周目标评价。
- 食物种类按标准化原料去重；同一种面粉的多种成品不重复算。
- 显示“明确低于目标”“可能低于”“区间覆盖目标”“可能高于”，避免把估算区间压成单点。

## 6. 推荐引擎

### 6.1 排序顺序

1. 安全门和明显数据异常。
2. 连续性总能量严重不足或过量。
3. 连续缺失蛋白质、蔬菜、水果等主要结构。
4. 三餐分配问题，尤其早餐不足和晚餐集中。
5. 一周鱼禽蛋肉、奶、谷薯和食物多样性。
6. 同类轮换、加工度和可执行的小优化。

### 6.2 输出形式

每次最多给1～3条行动，结构为：

```text
发现：过去3天早餐均未达到全天能量的1/3。
依据：BR-B-001、BR-B-002。
行动：明早在现有早餐上增加一种全谷/薯类，并补足蛋奶肉鱼中的一类。
复查：连续执行3天后重新评估。
```

不得使用“你缺乏某营养素”“可以治疗某疾病”等诊断式语言。

### 6.3 书中搭配模板

推荐优先重组书中案例，而不是生成无出处的固定食谱：

- 包子 + 鸡蛋 + 蔬菜 + 整个水果。
- 烙饼 + 鸡蛋/牛奶 + 水果。
- 全谷杂粮饭 + 鸡蛋/牛奶 + 水果。
- 午餐：蔬菜 + 肉/鱼/蛋 + 谷薯，约按1/2、1/4、1/4观察。
- 加餐：少量坚果 + 水果 + 奶/酸奶。

第一册示例中的果蔬汁不作为鲜果替代，故产品模板优先改成完整水果并标明这是对书内冲突的裁决。

## 7. 页面与交互

### 7.1 首页“今天怎么吃”

- 顶部：今日目标能量和三大营养素。
- 中部：早餐/午餐/晚餐时间线，支持粘贴一行字符串。
- 下部：今天最值得处理的1～3个问题，以及“下一餐建议”。
- 所有估算显示范围和“待确认”状态。

### 7.2 导入确认页

- 左侧/上方显示原始字符串。
- 每项可改名称、分类、状态、上下限和单位。
- 明确显示“油盐未知”“混合菜可能漏项”。
- 用户确认后才进入正式分析。

### 7.3 书本计算器页

- 输入身高、活动档位和超重调整开关。
- 展示标准体重、能量、三大营养素、早餐范围。
- 每个结果旁显示书内章节出处。
- 可切换到书中案例验证页面。

### 7.4 周报页

- 本周最稳定的优点。
- 最重要的1～3个缺口。
- 鱼/肉/蛋、食物种类和早餐达标趋势。
- 体重/腰围趋势只描述变化，不诊断原因。
- 下周可执行计划。

### 7.5 规则说明页

- 可按 `ruleId` 查询规则、出处、证据等级和产品推导。
- 明确区分“书中直接给出”与“为了计算而作的实现选择”。

## 8. 安全与隐私

- IndexedDB 本地优先，不上传餐食和身体数据。
- 不保存原始照片。
- 导出备份使用 PBKDF2-SHA-256 派生密钥，AES-256-GCM 加密。
- 新导出使用独立于 Dexie 版本的备份格式 v2；恢复时继续解析并迁移 v1 Payload。
- 密码只用于导出/恢复，不保存明文，也不设置独立应用登录密码。
- 恢复前校验备份版本、完整性和规则版本。
- GitHub Pages 仅托管静态资源，不承载私人数据。

## 9. 后续实现顺序

1. 固化规则目录和书中案例测试。
2. 实现 `HD1` 解析器及错误报告。
3. 实现个人目标计算器。
4. 建立最小食物字典和状态转换框架。
5. 实现餐食记录、每日评价和早餐评分。
6. 实现周报、问题排序和下一餐推荐。
7. 实现加密备份、PWA 离线和 GitHub Pages 构建。

在第4步引入食物成分资料前，应先单独确认数据来源、许可、食物状态和版本，不能凭记忆填写营养值。
