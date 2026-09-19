# 结构化知识数据

[返回手册目录](../README.md)

本目录是手册的机器可读底层，服务于来源追溯、自动校验、学习卡片生成和后续项目复用。读者正文仍位于上级目录。

## 文件

- `schema.json`：单条原子知识记录的数据规范。
- `claims.jsonl`：每行一条独立知识记录。
- `coverage.json`：按原书PART记录目录、原则、数字和全部知识点的覆盖程度。
- `books.json`：参与核验的EPUB版本、文件名、目录信息和SHA-256指纹。

## 数据原则

- 一条记录只表达一个主要结论。
- `statement`保持书中原始方向和口径，不添加无必要的反向换算。
- `BOOK_DIRECT`必须有原书文件和至少一个定位关键词。
- 病例、书中引用的指南、编辑概括和安全提示必须与作者直接陈述区分。
- 数值记录必须说明适用对象，并保留原始单位和每日、每周或每餐口径。
- 存在不同口径时分别建记录，并通过`conflicts`互相引用。
- 每条记录通过`coverageSectionId`关联覆盖矩阵的稳定章节ID。
- `evidenceFragments`保存支持结论的一个或多个短原文片段；每个片段内的结构化断言独立核对数字、单位、比较方向、时间口径和比例顺序，不允许跨片段拼接。
- 每条断言必须且只能归属一个`evidenceBindings`证据模型；所有`start`、`end`均相对于原始`evidenceFragments[].text`，采用从0开始、`end`不包含的UTF-16索引，并要求原始字符串切片与保存的`text`完全相同。
- `CONTIGUOUS`用于能够在一个连续跨度中同时找到对象、测量值、单位、比较符和时间口径的断言；无论是否经过人工复核，跨度都不能包含额外测量表达，也不能把更接近其他对象的测量绑定给当前对象。
- `ORDERED_LIST`只用于至少两个断言共享单位、比较符或时间口径的原文列表；组级跨度和共享口径必须是原文真实切片，列表项按原文顺序保存`assertionId`、`subjectSpan`和`measurementSpan`，当前测量必须位于当前对象之后、下一个对象之前。
- 列表中的assertion必须完整覆盖且不能遗漏、重复或引用组外ID；普通单条断言不得改用列表模型绕过连续跨度规则。
- “这三者”“这一项”等指代或跨子句推导无法由位置规则自动证明时，通过`semanticReview`明确标记人工语义复核状态；`HUMAN_REVIEW_REQUIRED`和`HUMAN_REVIEWED`都不能改变验证分支或为任何错配授权。
- 可发布知识统一定义为：`verificationStatus`为`DIRECT_TEXT_CHECKED`或`DOUBLE_CHECKED`，并且不存在`HUMAN_REVIEW_REQUIRED`。数值速查、正式学习卡和审计覆盖统一使用该规则。
- 无法严格证明关联的草稿只保留原文直接支持的`EVIDENCE_ONLY`组件；人工确认并重建结论断言、通过严格校验后，才能提升为可发布知识。
- `claimScope`明确断言绑定`statement`、`referenceLabel + referenceValue`中的哪一部分；已核验的数值或公式记录必须分别覆盖两个目标，不能只包含`EVIDENCE_ONLY`断言。
- 比例断言同时绑定对象顺序和数值顺序；公式正文必须包含完整表达式，只有速查值允许省略公式左侧。
- 每个结论断言通过`targetFragments`分别指向`statement`和速查值中的最小原子片段；片段必须是目标文本的真实子串，并独立包含对象、数值或范围、单位、比较方向和时间口径。
- 数量断言要求数值与单位直接相邻，比较符和时间口径必须围绕该测量表达就近匹配；多对象列表不得互换对象和值，也不能经由“且、和、顿号、分别”等连接方式从另一数字借用字段。
- 原文与整理后的结论采用不同精度表达时，必须通过`targetComparators`逐目标声明。目前只允许`EQ → APPROX`，且必须填写转换理由并将整条知识标为`DOUBLE_CHECKED`；其他转换直接失败。
- `DIRECT_TEXT_CHECKED`表示指定版本EPUB中的原文、结构化断言和证据跨度已经通过相应契约校验；存在`HUMAN_REVIEW_REQUIRED`时，不代表程序已经证明指代或推导语义，也不代表经过现行医学核验。

## 来源类型

- `BOOK_DIRECT`：作者在正文中直接陈述。
- `BOOK_CASE`：病例、示例或个案计算。
- `BOOK_QUOTED_GUIDE`：书中引用的指南或外部标准。
- `EDITOR_SUMMARY`：整理者根据多段原文作出的概括。
- `SAFETY_NOTE`：不属于作者观点的阅读和医疗安全提示。

## 覆盖状态

- `NOT_STARTED`：尚未系统处理。
- `PARTIAL`：已经整理一部分，不能声称完整。
- `VERIFIED`：该维度已按原书完成核对。
- `NOT_APPLICABLE`：该维度不适用。

目录、核心原则、关键数字和全部知识点分别记录状态，不能用单个“已整理”掩盖覆盖差异。

## 生成和校验

```powershell
npm run book:generate
npm run book:verify
npm run book:verify:structure
```

生成脚本只把可发布数字写入数值速查和`learning-cards.json`；其他知识只进入`learning-cards-draft.json`。两类卡片互斥并完整覆盖全部知识，均保留`verifiedAt`。待办集中生成到[人工复核清单](../manual-review.md)。`book:verify`默认要求两本指定版本EPUB存在并完成原文核验；`book:verify:structure`仅在明确允许缺少EPUB时使用，其成功不能称为原文核验通过。
