# 《你是你吃出来的》系列知识手册

这是一套面向学习、查阅和分享的主题式知识手册，整理范围包括：

- 《你是你吃出来的》
- 《你是你吃出来的2：慢病康复的饮食密码》

正文只保留有学习价值的知识点。书中位置、覆盖状态、冲突记录和医学核验状态放在独立文件中，不干扰日常阅读。

## 建议阅读顺序

1. 先读[知识地图](knowledge-map.md)，理解两本书之间的关系。
2. 再读能量和七大营养素，建立基础概念。
3. 阅读食物、三餐和不同人群，理解如何落到日常饮食。
4. 阅读营养诊疗流程，理解个体化方案如何形成。
5. 疾病专题只用于理解书中框架，不作为自我治疗方案。
6. 遇到已结构化核验的数字时，以[数值速查](numeric-reference.md)为统一入口；尚未结构化的数字仍以对应主题正文和覆盖状态为准。

## 基础营养

- [能量平衡](nutrients/energy.md)
- [蛋白质](nutrients/protein.md)
- [碳水化合物](nutrients/carbohydrate.md)
- [脂类](nutrients/fat.md)
- [维生素](nutrients/vitamins.md)
- [矿物质](nutrients/minerals.md)
- [膳食纤维](nutrients/fiber.md)
- [水](nutrients/water.md)

## 日常应用

- [食物选择与一日三餐](food-and-meals.md)
- [不同人群的营养重点](populations.md)
- [营养诊疗流程](nutrition-care-process.md)

## 疾病专题

- [高血压](diseases/hypertension.md)
- [血脂异常](diseases/dyslipidemia.md)
- [糖尿病和血糖异常](diseases/diabetes.md)
- [慢性肾病](diseases/kidney-disease.md)
- [痛风和高尿酸](diseases/gout.md)
- [肿瘤营养](diseases/cancer.md)
- [心脏疾病](diseases/heart-disease.md)

## 查阅与质量控制

- [数值、公式与比例速查](numeric-reference.md)
- [人工复核清单](manual-review.md)
- [书内冲突、歧义与知识缺口](conflicts-and-gaps.md)
- [医学核验状态](medical-validation.md)
- [术语表](glossary.md)
- [原书覆盖矩阵](coverage-matrix.md)
- [结构化知识数据与维护说明](data/README.md)
- [可追溯学习卡片数据](generated/learning-cards.json)
- [变更记录](CHANGELOG.md)

## 使用边界

- 手册准确表达书中知识，不自动代表当前最新医学共识。
- 书中引用的2016版膳食指南，不能冒充当前最新版指南。
- 病例结果只能说明作者如何分析个案，不能证明普遍疗效。
- 涉及疾病、用药、补充剂以及蛋白质、钠、钾、磷或液体限制时，应结合专业评估。

## AI使用约定

AI或后续项目使用本手册时，应遵守以下顺序：

1. 先从本页或[知识地图](knowledge-map.md)定位主题。
2. 涉及数字时同时读取[数值速查](numeric-reference.md)。
3. 涉及书内不一致时读取[冲突与缺口](conflicts-and-gaps.md)，不得擅自消除冲突。
4. 涉及疾病或对外健康建议时读取[医学核验状态](medical-validation.md)。
5. 只有[覆盖矩阵](coverage-matrix.md)对应维度标记为“已核对”的范围，才能声称该维度已经原书核对。
6. 回答时区分“书中认为”“书中病例”和“现行医学证据”，不能混写。
7. 批量生成学习卡片时使用[结构化知识数据](data/claims.jsonl)或其派生文件，不从整篇Markdown自由概括。
8. 正式学习只消费可发布卡片；来源已定位但待人工确认的内容位于`generated/learning-cards-draft.json`和[人工复核清单](manual-review.md)，不得混入正式卡片。
