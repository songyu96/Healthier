import {
  CATEGORY_LABELS,
  FOOD_CATEGORIES,
  FOOD_STATE_LABELS,
  FOOD_STATES,
  MEAL_LABELS,
  MEAL_TYPES,
  QUANTITY_UNITS
} from "./types";

function codeLines<T extends string>(
  codes: readonly T[],
  labels: Record<T, string>
): string {
  return codes.map((code) => `${code}=${labels[code]}`).join("\n");
}

function hd1Dictionary(): string {
  const mealTypes = codeLines(MEAL_TYPES, MEAL_LABELS);
  const categories = codeLines(FOOD_CATEGORIES, CATEGORY_LABELS);
  const states = codeLines(FOOD_STATES, FOOD_STATE_LABELS);

  return `格式：
HD1|YYYYMMDD-HHmm|餐次|食物1;食物2;...|烹调方式|备注

每项食物格式：
名称~分类代码~状态代码~最小值-最大值单位

餐次代码：
${mealTypes}

分类代码：
${categories}

状态代码：
${states}

单位只能使用：${QUANTITY_UNITS.join("、")}`;
}

export function createHd1AiPrompt(referenceDate: string): string {
  return `请把我描述的一餐转换为 Healthier 的 HD1 格式。

参考日期：${referenceDate}

信息充分后只输出一行 HD1 字符串，不要输出解释、Markdown、代码块或前后缀。如果缺少无法合理确认的进餐时间，请先只询问这一项；不要自行编造时间。

${hd1Dictionary()}

生成规则：
1. 一餐中的多种食物分别列出，用英文分号“;”分隔，不要合并成一项。
2. 不确定重量时给出诚实的合理范围，不要伪造单一精确值；最小值必须小于或等于最大值且最大值大于0。
3. 能判断生重、熟重、即食或包装标示时不要使用UN；pc只用于鸡蛋等可自然计数的食物。
4. 混合菜能辨认主要食材时尽量拆分；无法合理拆分时使用OT，并保留真实菜名。
5. 牛奶和奶制品用DA，豆浆和豆制品用SO，酒用AL，其他饮料用SD；果汁用SD，不用FR。
6. 不知道用油或盐的数量时，在备注中明确写“油盐未知”“用油未知”或“盐未知”。
7. 日期时间必须是有效的YYYYMMDD-HHmm；未说明日期时使用参考日期。
8. “|”“~”“;”是保留分隔符，不要在名称、烹调方式或备注正文中使用。
9. 输出前自行检查整行恰好包含6段，每项食物恰好包含4个字段。

我的餐食描述：
【请把这里替换成实际吃了什么、时间和大致份量】`;
}

export function createHd1ImagePrompt(referenceDateTime: string): string {
  return `请识别我与这段提示一起上传的餐食照片，并直接生成一条可在 Healthier 中人工确认和修改的 HD1 草稿。

参考本地日期时间：${referenceDateTime}

不要向我提问。只输出一行 HD1 字符串，不要输出识别过程、解释、Markdown、代码块、置信度或前后缀。照片无法提供精确事实时，使用保守的估计范围和未知标记，之后我会在 Healthier 的“解析并人工确认”页面修改。

${hd1Dictionary()}

照片估计规则：
1. 把照片中可见的不同食物分别列出，用英文分号“;”分隔；不要把整餐合并成一项。
2. 根据餐盘、碗杯、包装、食物数量和常见份量估计实际呈现的可食重量范围；范围可以较宽，不要伪造单一精确克数。
3. 被遮挡、无法辨认或只能猜测的食物不要虚构；能确认菜名但无法拆分原料时保留菜名并使用OT。
4. 熟制食物按照片中的熟重估计并使用CK；直接食用的成品可用EA；只有包装净含量或标签口径清楚时才使用PK。
5. 鸡蛋等自然可计数食物可以使用pc；其他食物优先使用g，饮料使用ml。
6. 牛奶和奶制品用DA，豆浆和豆制品用SO，酒用AL，其他饮料用SD；果汁用SD，不用FR。
7. 照片不能可靠判断隐藏的烹调油、盐、酱汁和糖；不要补算，备注中写“照片估计，油盐未知”。
8. 看不出烹调方法时写“照片估计”，不要自行指定水煮、清炒或油炸。
9. 用户未另行说明进餐日期时间时，采用参考本地日期时间，并据此选择B、L、D或S；之后用户会人工修改。
10. “|”“~”“;”是保留分隔符，不要在名称、烹调方式或备注正文中使用。
11. 输出前自行检查整行恰好包含6段，每项食物恰好包含4个字段。`;
}
