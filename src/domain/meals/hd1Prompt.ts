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

export function createHd1AiPrompt(referenceDate: string): string {
  const mealTypes = codeLines(MEAL_TYPES, MEAL_LABELS);
  const categories = codeLines(FOOD_CATEGORIES, CATEGORY_LABELS);
  const states = codeLines(FOOD_STATES, FOOD_STATE_LABELS);

  return `请把我描述的一餐转换为 Healthier 的 HD1 格式。

参考日期：${referenceDate}

信息充分后只输出一行 HD1 字符串，不要输出解释、Markdown、代码块或前后缀。如果缺少无法合理确认的进餐时间，请先只询问这一项；不要自行编造时间。

格式：
HD1|YYYYMMDD-HHmm|餐次|食物1;食物2;...|烹调方式|备注

每项食物格式：
名称~分类代码~状态代码~最小值-最大值单位

餐次代码：
${mealTypes}

分类代码：
${categories}

状态代码：
${states}

单位只能使用：${QUANTITY_UNITS.join("、")}

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
