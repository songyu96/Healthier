import type { DailyAssessment, RecommendedAction } from "./types";

export function recommendNextMeal(assessment: DailyAssessment): RecommendedAction[] {
  if (assessment.targets.safetyRestricted) {
    return assessment.targets.safetyMessages.slice(0, 3).map((message, index) => ({
      id: `safety-${index}`,
      title: "先做专业评估",
      detail: message,
      ruleIds: ["BR-A-002"],
      kind: "SAFETY" as const
    }));
  }

  const actions: RecommendedAction[] = [];
  const add = (action: RecommendedAction) => {
    if (actions.length < 3) actions.push(action);
  };

  if (assessment.groups.vegetable.max < assessment.targets.foodGroups.vegetable.min) {
    add({
      id: "vegetable-gap",
      title: "下一餐先补蔬菜",
      detail: "把蔬菜安排到餐盘约一半，深色与其他蔬菜轮换。",
      ruleIds: ["BR-F-002", "BR-L-001"],
      kind: "NEXT_MEAL"
    });
  }

  if (assessment.nutrition.max.protein < assessment.targets.proteinG * 0.8) {
    add({
      id: "protein-gap",
      title: "补一份可靠蛋白质",
      detail: "从鱼、禽畜瘦肉、蛋、奶或豆制品中选择，并与当天已经吃过的种类轮换。",
      ruleIds: ["BR-M-003", "BR-Q-003"],
      kind: "NEXT_MEAL"
    });
  }

  if (assessment.groups.fruit.max < assessment.targets.foodGroups.fruit.min) {
    add({
      id: "fruit-gap",
      title: "安排新鲜水果",
      detail: "选择完整水果作为正餐组成或加餐；果汁不计入鲜果目标。",
      ruleIds: ["BR-F-003"],
      kind: "NEXT_MEAL"
    });
  }

  if (assessment.groups.dairy.max < assessment.targets.foodGroups.dairy.min) {
    add({
      id: "dairy-gap",
      title: "奶类仍有缺口",
      detail: "可在下一餐或加餐安排牛奶、酸奶等奶制品。",
      ruleIds: ["BR-F-004"],
      kind: "NEXT_MEAL"
    });
  }

  if (actions.length === 0) {
    add({
      id: "keep-balance",
      title: "继续保持结构完整",
      detail: "下一餐仍让粮食、蛋白质和蔬菜同时出现，并优先轮换食材。",
      ruleIds: ["BR-Q-001", "BR-Q-003"],
      kind: "NEXT_MEAL"
    });
  }

  return actions;
}

