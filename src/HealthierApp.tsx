import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type PropsWithChildren
} from "react";
import { NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { registerSW } from "virtual:pwa-register";
import {
  ACTIVITY_LEVELS,
  BEVERAGE_SUGAR_PROFILES,
  BEVERAGE_SUGAR_PROFILE_LABELS,
  BOOK_CHAPTERS,
  CATEGORY_LABELS,
  FOOD_CATEGORIES,
  FOOD_KINDS,
  FOOD_STATE_LABELS,
  FOOD_STATES,
  MEAL_TEMPLATES,
  MEAL_LABELS,
  MIXED_MEAL_KINDS,
  MIXED_MEAL_LABELS,
  QUANTITY_UNITS,
  SEASONING_LABELS,
  SEASONING_LEVELS,
  applyCurrentSafetyAdmission,
  assessDay,
  assessWeek,
  appendQuickMealFood,
  bookLocationLabel,
  calculateNutrition,
  calculateTargets,
  createMealDraftFromTemplate,
  createHd1AiPrompt,
  createHd1ImagePrompt,
  createMixedMealDraft,
  createQuickMealDraft,
  createRepeatMealDraft,
  findBookChapter,
  nutritionFactsForMeal,
  parseHd1,
  recentFoodIds,
  recommendNextMeal,
  resolveDailyTargets,
  validateMealDraft,
  type ActivityLevel,
  type BeverageSugarProfile,
  type BookChapterKnowledge,
  type BookKnowledgeCategory,
  type BookKnowledgeItem,
  type BookKnowledgeSourceKind,
  type ConfirmedMeal,
  type DailyAssessment,
  type DailyTargets,
  type FoodCategory,
  type FoodKind,
  type FoodReference,
  type FoodState,
  type HealthFlag,
  type MealItemInput,
  type MixedMealKind,
  type NutrientKey,
  type NutritionFacts,
  type ParsedMeal,
  type QuantityUnit,
  type SeasoningLevel,
  type UserProfile,
  type WeeklyAssessment
} from "./domain";
import { BUILT_IN_FOODS, mergeFoodRegistry } from "./domain/nutrition/foodRegistry";
import { nutrientsFromFormValues, nutrientsToFormValues, type NutrientFormValue } from "./domain/nutrition/foodOverrides";
import {
  db,
  deleteMeal,
  getDayCompletion,
  getSetting,
  loadMealsBetween,
  loadMealsForDate,
  saveConfirmedMeal,
  setDayCompletion,
  setSetting,
  type AppSetting,
  type BodyMetric,
  type FoodOverride
} from "./db";
import { decryptBackup, exportEncryptedBackup, readBackupPayload, restoreBackup, type BackupPayload } from "./backup";
import {
  acceptSyncBaseline,
  calculateBusinessDataHash,
  classifySyncImport,
  createSyncPackage,
  getLocalSyncState,
  inspectSyncPackage,
  SYNC_STATE_KEY,
  type InspectedSyncPackage,
  type LocalSyncState,
  type SyncImportStatus
} from "./sync";
import { AppProvider, useApp } from "./context/AppContext";

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  BEDRIDDEN: "卧床（25 kcal/kg）",
  LIGHT: "轻体力/电脑工作（30 kcal/kg）",
  MODERATE: "中体力（35 kcal/kg）",
  HEAVY: "重体力（40 kcal/kg）"
};

const FOOD_KIND_LABELS: Record<FoodKind, string> = {
  INGREDIENT: "常见单品",
  COMPOSITE: "组合食品",
  PACKAGED: "包装食品"
};

function resolveFoodKind(food: FoodReference): FoodKind {
  return food.foodKind ?? "INGREDIENT";
}

export function foodCategoriesForKind(
  foods: FoodReference[],
  kind: "ALL" | FoodKind
): FoodCategory[] {
  const available = new Set(
    foods
      .filter((food) => kind === "ALL" || resolveFoodKind(food) === kind)
      .map((food) => food.category)
  );
  return FOOD_CATEGORIES.filter((category) => available.has(category));
}

function foodSourceLabel(food: FoodReference): string {
  if (food.source.method === "RECIPE") return "通用配方估值";
  if (food.source.method === "LABEL") return "包装营养标签";
  if (food.source.method === "OFFICIAL_COMPOSITION") {
    return food.source.kind === "USDA_FDC" ? "美国农业部食物成分资料" : "官方食物成分资料";
  }
  if (food.source.kind === "USER") return "我的本地数据";
  if (food.source.kind === "BOOK") return "书本参考数据";
  if (food.source.kind === "REFERENCE") return "内置常见记录条目";
  return "美国农业部食物成分资料";
}

export function foodQualityLabel(food: FoodReference): string {
  if (food.source.method === "RECIPE") return food.recipeEstimate?.confidence === "LOW" ? "低置信度估算" : "配方估算";
  if (food.source.method === "LABEL") return "包装标签";
  if (food.partialNutrientsPer100) return "部分营养可计算";
  if (food.source.method === "OFFICIAL_COMPOSITION" || food.source.kind === "USDA_FDC") return "官方通用数据";
  if (food.source.kind === "BOOK") return "书本近似数据";
  if (food.source.kind === "USER") return "用户数据";
  return food.nutrientsPer100 ? "通用参考数据" : "仅记录";
}

function formatFoodNutrients(food: FoodReference): string | undefined {
  const nutrients = food.nutrientsPer100 ?? food.partialNutrientsPer100;
  if (!nutrients) return undefined;
  const value = (key: keyof typeof nutrients, digits: number, unit: string) =>
    nutrients[key] === undefined ? "未知" : `${nutrients[key].toFixed(digits)} ${unit}`;
  return `每100${food.basisUnit}：${value("kcal", 0, "kcal")} · 蛋白质 ${value("protein", 1, "g")} · 脂肪 ${value("fat", 1, "g")} · 碳水 ${value("carb", 1, "g")} · 纤维 ${value("fiber", 1, "g")}`;
}

function normalizedFoodSearch(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

export function isHiddenBuiltInFallbackFood(food: FoodReference): boolean {
  return (
    food.source.kind !== "USER"
    && !food.nutrientsPer100
    && !food.partialNutrientsPer100
  );
}

export function filterFoodsForMealEditor(
  foods: FoodReference[],
  query: string,
  selectedId?: string
): FoodReference[] {
  const normalizedQuery = normalizedFoodSearch(query);
  const ranked = foods
    .filter((food) => !isHiddenBuiltInFallbackFood(food) || food.id === selectedId)
    .map((food) => {
      const name = normalizedFoodSearch(food.name);
      const aliases = food.aliases.map(normalizedFoodSearch);
      const haystack = [
        food.name,
        ...food.aliases,
        ...(food.tags ?? []),
        ...(food.beverageSugarProfile ? [BEVERAGE_SUGAR_PROFILE_LABELS[food.beverageSugarProfile]] : [])
      ]
        .map(normalizedFoodSearch)
        .join(" ");
      const score = food.id === selectedId ? -2
        : name === normalizedQuery || aliases.includes(normalizedQuery) ? -1
          : 0;
      return { food, score, matches: !normalizedQuery || haystack.includes(normalizedQuery) };
    })
    .filter((entry) => entry.matches || entry.food.id === selectedId)
    .sort((left, right) => left.score - right.score || left.food.name.localeCompare(right.food.name, "zh-CN"));

  return ranked.slice(0, 60).map((entry) => entry.food);
}

export function commonPortions(unit: QuantityUnit): number[] {
  if (unit === "pc") return [1, 2];
  if (unit === "ml") return [250, 500];
  return [50, 100, 200];
}

const HEALTH_FLAGS: { value: HealthFlag; label: string }[] = [
  { value: "DISEASE", label: "已确诊疾病" },
  { value: "MEDICATION", label: "正在用药" },
  { value: "PREGNANT", label: "孕产期" },
  { value: "MINOR", label: "未成年人" },
  { value: "EATING_DISORDER", label: "存在进食障碍风险" },
  { value: "ABNORMAL_TESTS", label: "有重要异常检查/化验结果" },
  { value: "PERSISTENT_SYMPTOMS", label: "有持续症状" },
  { value: "MALNUTRITION", label: "有明显营养不良风险" }
];

function localDateKey(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function localDateTime(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return `${new Date(date.getTime() - offset).toISOString().slice(0, 16)}:00`;
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function number(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatRange(min: number, max: number, unit: string, digits = 0): string {
  const left = min.toFixed(digits);
  const right = max.toFixed(digits);
  return min === max ? `${left} ${unit}` : `${left}～${right} ${unit}`;
}

function formatWeeklyGroup(min: number, max: number, incomparable: boolean): string {
  const known = formatRange(min, max, "g");
  return incomparable ? `不可比较（已知可比小计 ${known}）` : known;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}

function downloadTextFile(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultProfile(existing?: UserProfile): UserProfile {
  return existing ?? {
    id: "default",
    sex: "UNSPECIFIED",
    heightCm: 175,
    currentWeightKg: 70,
    activityLevel: "LIGHT",
    overweightAdjustmentEnabled: false,
    healthFlags: [],
    updatedAt: new Date().toISOString()
  };
}

function useFoodReferences(): FoodReference[] {
  const overrides = useLiveQuery(() => db.foodOverrides.toArray(), [], []);
  return useMemo(() => mergeFoodRegistry(overrides), [overrides]);
}

function mealFacts(meals: ConfirmedMeal[], foods: FoodReference[]) {
  return meals.map((meal) => ({ meal, facts: nutritionFactsForMeal(meal, foods) }));
}

function settingValue(settings: AppSetting[], key: string): unknown {
  return settings.find((setting) => setting.key === key)?.value;
}

function completedFromSettings(settings: AppSetting[], date: string): boolean {
  const completion = settingValue(settings, `dayComplete:${date}`);
  if (typeof completion === "boolean") return completion;
  if (!completion || typeof completion !== "object") return false;
  const revision = settingValue(settings, `dayRevision:${date}`);
  const completionValue = completion as { completed?: unknown; revision?: unknown };
  return completionValue.completed === true &&
    completionValue.revision === (typeof revision === "number" ? revision : 0);
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <path className="brand-orbit" d="M34 12c-12-1.5-22 7-22.7 19.3C10.6 44 20 54 32.6 54c12 0 22-9.3 22-21.3 0-9.3-5.3-16.7-14-19.3" />
        <path className="brand-sprout" d="M44 14.7c4.7-2.7 8-2.7 10.7-1.3-1.3 4.7-4 7.3-9.3 8" />
        <path className="brand-seed" d="M32 21.3c-6.7 5.3-8 14-1.3 21.3 7.3-5.3 9.3-14 2.7-21.3Z" />
        <path className="brand-seed-vein" d="M32.7 25c0 6.7-.7 12-2 17" />
      </svg>
    </span>
  );
}

export function BrandWordmark() {
  return (
    <span className="brand-copy">
      <strong className="brand-wordmark" aria-label="Healthier">
        <span aria-hidden="true">H<span className="brand-eat">e</span><span className="brand-eat">a</span>l<span className="brand-eat">t</span>h<span className="brand-self">i</span>er</span>
      </strong>
      <small>饮食与身心状态记录</small>
    </span>
  );
}

function Layout({ children }: PropsWithChildren) {
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdate(() => async () => applyUpdate(true));
      }
    });
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="回到今日记录">
          <BrandMark />
          <BrandWordmark />
        </NavLink>
        <span className="local-badge">仅存本机</span>
      </header>
      {update && (
        <button className="update-banner" type="button" onClick={() => { if (confirm("更新会刷新页面，请确认已保存当前草稿。继续更新？")) void update(); }}>
          新版本已准备好，点此更新
        </button>
      )}
      <main>{children}</main>
      <nav className="bottom-nav" aria-label="主要页面">
        <NavLink to="/" end>今日</NavLink>
        <NavLink to="/calculator">计算器</NavLink>
        <NavLink to="/history">周总结</NavLink>
        <NavLink to="/foods">食物库</NavLink>
        <NavLink to="/book">书本</NavLink>
        <NavLink to="/settings">设置</NavLink>
      </nav>
    </div>
  );
}

interface MealDraftEditorProps {
  draft: ParsedMeal | ConfirmedMeal;
  foods: FoodReference[];
  onChange: (draft: ParsedMeal | ConfirmedMeal) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

function MealDraftEditor({ draft, foods, onChange, onCancel, onSave, saving }: MealDraftEditorProps) {
  const updateItem = (index: number, changes: Partial<MealItemInput>) => {
    const items = draft.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item);
    onChange({ ...draft, items });
  };

  return (
    <section id="meal-draft-editor" className="card editor-card">
      <div className="section-heading">
        <div><span className="eyebrow">人工确认</span><h2>确认食物与重量</h2></div>
        <button className="text-button" type="button" onClick={onCancel}>取消</button>
      </div>
      <div className="form-grid two-columns">
        <label>餐次
          <select value={draft.mealType} onChange={(event) => onChange({ ...draft, mealType: event.target.value as ConfirmedMeal["mealType"] })}>
            {Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>进餐时间
          <input type="datetime-local" value={draft.eatenAt.slice(0, 16)} onChange={(event) => onChange({ ...draft, eatenAt: `${event.target.value}:00`, date: event.target.value.slice(0, 10) })} />
        </label>
      </div>
      <div className="item-editor-list">
        {draft.items.map((item, index) => {
          const matches = filterFoodsForMealEditor(foods, item.name, item.canonicalFoodId);
          return (
            <fieldset className="item-editor" key={item.tempId}>
              <legend>食物 {index + 1}</legend>
              <label>名称 / 搜索食物库<input type="search" placeholder="输入名称、别名或标签" value={item.name} onChange={(event) => updateItem(index, { name: event.target.value, canonicalFoodId: undefined })} /></label>
              <label>匹配食物库（跨分类）
                <select value={item.canonicalFoodId ?? ""} onChange={(event) => {
                  const selected = foods.find((food) => food.id === event.target.value);
                  updateItem(index, selected ? { canonicalFoodId: selected.id, name: selected.name, category: selected.category } : { canonicalFoodId: undefined });
                }}>
                  <option value="">按名称自动匹配 / 保持未知</option>
                  {matches.map((food) => <option key={food.id} value={food.id}>{food.name} · {CATEGORY_LABELS[food.category]}</option>)}
                </select>
              </label>
              <label>分类
                <select value={item.category} onChange={(event) => updateItem(index, { category: event.target.value as FoodCategory, canonicalFoodId: undefined })}>
                  {FOOD_CATEGORIES.map((category) => <option key={category} value={category}>{category} · {CATEGORY_LABELS[category]}</option>)}
                </select>
              </label>
              <label>状态
                <select value={item.state} onChange={(event) => updateItem(index, { state: event.target.value as FoodState })}>
                  {FOOD_STATES.map((state) => <option key={state} value={state}>{state} · {FOOD_STATE_LABELS[state]}</option>)}
                </select>
              </label>
              <label>下限<input type="number" min="0" step="0.1" value={item.quantityMin} onChange={(event) => updateItem(index, { quantityMin: number(event.target.value) })} /></label>
              <label>上限<input type="number" min="0" step="0.1" value={item.quantityMax} onChange={(event) => updateItem(index, { quantityMax: number(event.target.value) })} /></label>
              <label>单位
                <select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as QuantityUnit })}>
                  {QUANTITY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <div className="quick-portions" role="group" aria-label={`${item.name || `食物 ${index + 1}`}常用份量`}>
                <span>常用份量</span>
                {commonPortions(item.unit).map((quantity) => (
                  <button className="portion-button" type="button" key={quantity} onClick={() => updateItem(index, { quantityMin: quantity, quantityMax: quantity })}>
                    {quantity}{item.unit}
                  </button>
                ))}
              </div>
              <button className="danger text-button" type="button" onClick={() => onChange({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}>移除</button>
            </fieldset>
          );
        })}
      </div>
      <button className="secondary full-width" type="button" onClick={() => onChange({
        ...draft,
        items: [...draft.items, { tempId: crypto.randomUUID(), name: "", category: "OT", state: "UN", quantityMin: 0, quantityMax: 0, unit: "g" }]
      })}>＋ 添加一项</button>
      <div className="form-grid two-columns compact-grid">
        <label className="checkbox"><input type="checkbox" checked={draft.unknownOil} onChange={(event) => onChange({ ...draft, unknownOil: event.target.checked })} />油量未知</label>
        <label className="checkbox"><input type="checkbox" checked={draft.unknownSalt} onChange={(event) => onChange({ ...draft, unknownSalt: event.target.checked })} />盐量未知</label>
      </div>
      <label>烹调方式<input value={draft.cookingMethod} onChange={(event) => onChange({ ...draft, cookingMethod: event.target.value })} /></label>
      <label>备注<textarea rows={2} value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} /></label>
      <button className="primary full-width" type="button" disabled={saving || draft.items.length === 0} onClick={onSave}>{saving ? "保存中…" : "确认并保存"}</button>
    </section>
  );
}

interface QuickMealCardProps {
  foods: FoodReference[];
  favoriteFoodIds: string[];
  favoriteFoods: FoodReference[];
  recentFoods: FoodReference[];
  draft?: ParsedMeal | ConfirmedMeal;
  onAdd: (
    food: FoodReference,
    eatenAt: string,
    mealType: ConfirmedMeal["mealType"],
    unknownOil: boolean,
    unknownSalt: boolean
  ) => void;
  onToggleFavorite: (foodId: string) => void;
  onRemoveDraftItem: (tempId: string) => void;
  onClearDraft: () => void;
  onReviewDraft: () => void;
}

function mealTypeForNow(date = new Date()): ConfirmedMeal["mealType"] {
  const hour = date.getHours();
  if (hour < 10) return "B";
  if (hour < 15) return "L";
  if (hour < 21) return "D";
  return "S";
}

export function QuickMealCard({
  foods,
  favoriteFoodIds,
  favoriteFoods,
  recentFoods,
  draft,
  onAdd,
  onToggleFavorite,
  onRemoveDraftItem,
  onClearDraft,
  onReviewDraft
}: QuickMealCardProps) {
  const [query, setQuery] = useState("");
  const [mealType, setMealType] = useState<ConfirmedMeal["mealType"]>(() => mealTypeForNow());
  const [eatenAt, setEatenAt] = useState(() => localDateTime());
  const [unknownOil, setUnknownOil] = useState(true);
  const [unknownSalt, setUnknownSalt] = useState(true);
  const results = useMemo(
    () => query.trim() ? filterFoodsForMealEditor(foods, query).slice(0, 8) : [],
    [foods, query]
  );
  const add = (food: FoodReference) => {
    onAdd(food, eatenAt, mealType, unknownOil, unknownSalt);
    setQuery("");
  };
  const draftItemCount = draft?.items.length ?? 0;

  return (
    <section className="card quick-meal-card">
      <div className="section-heading">
        <div><span className="eyebrow">最快入口</span><h2>把这一餐逐项加进来</h2></div>
        <span className="step-pill">{draftItemCount > 0 ? `已选 ${draftItemCount} 项` : "新建一餐"}</span>
      </div>
      {!draft && <><div className="form-grid two-columns">
        <label>餐次<select value={mealType} onChange={(event) => setMealType(event.target.value as ConfirmedMeal["mealType"])}>
          {Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>进餐时间<input type="datetime-local" value={eatenAt.slice(0, 16)} onChange={(event) => setEatenAt(event.target.value + ":00")} /></label>
      </div>
      <div className="form-grid two-columns compact-grid">
        <label className="checkbox"><input type="checkbox" checked={unknownOil} onChange={(event) => setUnknownOil(event.target.checked)} />油量未知</label>
        <label className="checkbox"><input type="checkbox" checked={unknownSalt} onChange={(event) => setUnknownSalt(event.target.checked)} />盐量未知</label>
      </div></>}
      {draft && <div className="quick-draft-tray">
        <div className="quick-draft-heading">
          <div><b>本餐已选 {draftItemCount} 项</b><small>{MEAL_LABELS[draft.mealType]} · {draft.eatenAt.slice(11, 16)} · 还可以继续添加</small></div>
          <button className="text-button danger" type="button" onClick={onClearDraft}>取消本餐</button>
        </div>
        <div className="quick-draft-items">
          {draft.items.map((item) => <div key={item.tempId}>
            <span><b>{item.name || "未命名食物"}</b><small>{item.quantityMin === item.quantityMax ? item.quantityMin : `${item.quantityMin}～${item.quantityMax}`}{item.unit}</small></span>
            <button className="text-button danger" type="button" aria-label={`移除${item.name || "未命名食物"}`} onClick={() => onRemoveDraftItem(item.tempId)}>移除</button>
          </div>)}
        </div>
        <button className="primary full-width" type="button" onClick={onReviewDraft}>核对 {draftItemCount} 项并保存</button>
      </div>}
      {favoriteFoods.length > 0 && <div className="quick-food-group">
        <b>我的收藏</b>
        <div className="food-chip-list">
          {favoriteFoods.map((food) => <button className="food-chip" type="button" key={food.id} onClick={() => add(food)}>★ {food.name}</button>)}
        </div>
      </div>}
      {recentFoods.length > 0 && <div className="quick-food-group">
        <b>最近使用</b>
        <div className="food-chip-list">
          {recentFoods.map((food) => <button className="food-chip" type="button" key={food.id} onClick={() => add(food)}>{food.name}</button>)}
        </div>
      </div>}
      <label>搜索并加入本餐<input type="search" placeholder="例如：鸡蛋、牛奶、米饭" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {query.trim() && <div className="quick-food-results">
        {results.map((food) => {
          const favorite = favoriteFoodIds.includes(food.id);
          const defaultPortion = food.gramsPerPiece ? "1pc" : food.basisUnit === "ml" ? "250ml" : "100g";
          return <article key={food.id}>
            <div><b>{food.name}</b><small>{CATEGORY_LABELS[food.category]} · 默认 {defaultPortion}</small></div>
            <div className="quick-food-actions">
              <button className="text-button" type="button" aria-pressed={favorite} onClick={() => onToggleFavorite(food.id)}>{favorite ? "★ 已收藏" : "☆ 收藏"}</button>
              <button className="secondary" type="button" onClick={() => add(food)}>加入本餐</button>
            </div>
          </article>;
        })}
        {results.length === 0 && <p className="empty-state">没有可计算的匹配食物；可前往食物库新增本地数据。</p>}
      </div>}
      <p className="helper">每找到一种食物就点“加入本餐”，全部加入后再统一核对份量并保存。</p>
    </section>
  );
}

export function AssessmentPanel({ assessment }: { assessment: DailyAssessment }) {
  const actions = recommendNextMeal(assessment);
  const isIncomplete = (key: "kcal" | "protein" | "fat" | "carb") =>
    !(assessment.nutritionCoverage?.[key].complete ?? assessment.nutritionComplete);
  return (
    <>
      <section className="card hero-assessment">
        <span className="eyebrow">{assessment.nutritionComplete ? "今日摄入区间" : "今日已知摄入小计"}</span>
        {!assessment.nutritionComplete && (
          <p>部分食物或营养素缺少可靠数据；带“已知小计”的数字没有未知部分的上界。</p>
        )}
        <div className="energy-row">
          <strong>{formatRange(assessment.nutrition.min.kcal, assessment.nutrition.max.kcal, "kcal")}{isIncomplete("kcal") ? "（已知小计）" : ""}</strong>
          {!assessment.targets.safetyRestricted && <span>目标 {assessment.targets.energyKcal.toFixed(0)} kcal</span>}
        </div>
        <div className="macro-grid">
          <div><span>蛋白质</span><b>{formatRange(assessment.nutrition.min.protein, assessment.nutrition.max.protein, "g", 1)}{isIncomplete("protein") ? "（已知小计）" : ""}</b></div>
          <div><span>碳水</span><b>{formatRange(assessment.nutrition.min.carb, assessment.nutrition.max.carb, "g", 1)}{isIncomplete("carb") ? "（已知小计）" : ""}</b></div>
          <div><span>脂肪</span><b>{formatRange(assessment.nutrition.min.fat, assessment.nutrition.max.fat, "g", 1)}{isIncomplete("fat") ? "（已知小计）" : ""}</b></div>
        </div>
        {!assessment.targets.safetyRestricted && <p className="knowledge-context-links"><NavLink className="inline-link" to="/book/B1-ENERGY">为什么这样计算能量和三大营养素？</NavLink></p>}
      </section>
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">最优先</span><h2>下一餐这样安排</h2></div></div>
        <div className="action-list">
          {actions.map((action, index) => (
            <article key={action.id}><span>{index + 1}</span><div><h3>{action.title}</h3><p>{action.detail}</p><small>{action.ruleIds.join(" · ")}</small></div></article>
          ))}
        </div>
        {!assessment.targets.safetyRestricted && <p className="knowledge-context-links"><NavLink className="inline-link" to="/book/B1-DINNER">为什么下一餐优先补当天缺口？</NavLink></p>}
      </section>
      {!assessment.targets.safetyRestricted && <section className="card">
        <div className="section-heading"><div><span className="eyebrow">结构检查</span><h2>今天吃得完整吗</h2></div></div>
        <div className="status-grid">
          <div><span>早餐评分</span><b>{assessment.breakfastScore ? formatRange(assessment.breakfastScore.min, assessment.breakfastScore.max, "分") : "未记录"}</b></div>
          <div><span>午餐三类</span><b>{assessment.lunchGroupsComplete === undefined ? "未记录" : assessment.lunchGroupsComplete ? "齐全" : "不齐全"}</b></div>
          <div><span>蔬菜</span><b>{formatRange(assessment.groups.vegetable.min, assessment.groups.vegetable.max, "g")}{assessment.incomparableGroups.includes("vegetable") ? "（已知可比小计）" : ""}</b></div>
          <div><span>鲜果</span><b>{formatRange(assessment.groups.fruit.min, assessment.groups.fruit.max, "g")}{assessment.incomparableGroups.includes("fruit") ? "（已知可比小计）" : ""}</b></div>
          <div><span>液态奶口径</span><b>{formatRange(assessment.groups.dairy.min, assessment.groups.dairy.max, "ml")}{assessment.incomparableGroups.includes("dairy") ? "（已知可比小计）" : ""}</b></div>
          <div><span>食物种类</span><b>{assessment.foodVarietyCount} 种</b></div>
        </div>
        <p className="helper">午餐仅判断三类结构是否出现；书本克数目标只比较有明确生熟重与单位口径的记录。</p>
        <p className="knowledge-context-links"><NavLink className="inline-link" to="/book/B1-BREAKFAST">早餐评分依据</NavLink><NavLink className="inline-link" to="/book/B1-MATCH">一餐搭配依据</NavLink></p>
        {assessment.warnings.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}
      </section>}
    </>
  );
}

function MixedMealEstimatorCard({ onCreate, embedded = false }: { onCreate: (draft: ParsedMeal, label: string) => void; embedded?: boolean }) {
  const [kind, setKind] = useState<MixedMealKind>("HOTPOT");
  const [mealType, setMealType] = useState<ConfirmedMeal["mealType"]>("D");
  const [meatG, setMeatG] = useState(100);
  const [fishG, setFishG] = useState(0);
  const [eggG, setEggG] = useState(0);
  const [vegetableG, setVegetableG] = useState(200);
  const [grainG, setGrainG] = useState(100);
  const [tuberG, setTuberG] = useState(0);
  const [soyG, setSoyG] = useState(0);
  const [seasoningLevel, setSeasoningLevel] = useState<SeasoningLevel>("NORMAL");
  const hasMainFood = meatG > 0 || fishG > 0 || eggG > 0 || vegetableG > 0 || grainG > 0 || tuberG > 0 || soyG > 0;

  return <section className={embedded ? "today-tool-section" : "card"}>
    <div className="section-heading">
      <div><span className="eyebrow">聚餐估算</span><h2>按吃进去的类别重量记录</h2></div>
      <span className="step-pill">熟重/可食重量</span>
    </div>
    <p className="helper">适合无法逐项回忆的火锅、麻辣烫和烧烤。填写大致克数后仍会进入人工确认；油、盐和汤底默认未知，不自动补数值。</p>
    <div className="form-grid two-columns">
      <label>场景<select value={kind} onChange={(event) => setKind(event.target.value as MixedMealKind)}>
        {MIXED_MEAL_KINDS.map((value) => <option key={value} value={value}>{MIXED_MEAL_LABELS[value]}</option>)}
      </select></label>
      <label>餐次<select value={mealType} onChange={(event) => setMealType(event.target.value as ConfirmedMeal["mealType"])}>
        {Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>畜禽肉（g）<input type="number" min="0" step="10" value={meatG} onChange={(event) => setMeatG(number(event.target.value))} /></label>
      <label>鱼虾（g）<input type="number" min="0" step="10" value={fishG} onChange={(event) => setFishG(number(event.target.value))} /></label>
      <label>蛋（g）<input type="number" min="0" step="10" value={eggG} onChange={(event) => setEggG(number(event.target.value))} /></label>
      <label>蔬菜（g）<input type="number" min="0" step="10" value={vegetableG} onChange={(event) => setVegetableG(number(event.target.value))} /></label>
      <label>米饭/面食（g）<input type="number" min="0" step="10" value={grainG} onChange={(event) => setGrainG(number(event.target.value))} /></label>
      <label>薯类（g）<input type="number" min="0" step="10" value={tuberG} onChange={(event) => setTuberG(number(event.target.value))} /></label>
      <label>豆制品（g，可选）<input type="number" min="0" step="10" value={soyG} onChange={(event) => setSoyG(number(event.target.value))} /></label>
    </div>
    <label>锅底、刷油和蘸料<select value={seasoningLevel} onChange={(event) => setSeasoningLevel(event.target.value as SeasoningLevel)}>
      {SEASONING_LEVELS.map((value) => <option key={value} value={value}>{SEASONING_LABELS[value]}</option>)}
    </select></label>
    <button className="secondary full-width" type="button" disabled={!hasMainFood} onClick={() => {
      const draft = createMixedMealDraft({
        kind, eatenAt: localDateTime(), mealType, meatG, fishG, eggG, vegetableG, grainG, tuberG, soyG, seasoningLevel
      });
      onCreate(draft, MIXED_MEAL_LABELS[kind]);
    }}>生成估算草稿并确认</button>
  </section>;
}

function TodayPage() {
  const { profile } = useApp();
  const foods = useFoodReferences();
  const today = localDateKey();
  const meals = useLiveQuery(() => loadMealsForDate(today), [today], []);
  const recentMeals = useLiveQuery(() => loadMealsBetween(dateOffset(-30), today), [today], []);
  const completed = useLiveQuery(() => getDayCompletion(today), [today], false);
  const storedDayTarget = useLiveQuery(() => getSetting<unknown>(`dayTarget:${today}`, undefined), [today]);
  const waterMl = useLiveQuery(() => getSetting(`water:${today}`, 0), [today], 0);
  const storedFavoriteFoodIds = useLiveQuery(() => getSetting<unknown>("favoriteFoodIds", []), [], []);
  const [rawLine, setRawLine] = useState(`HD1|${today.replaceAll("-", "")}-0800|B|鸡蛋~EG~CK~1-1pc;牛奶~DA~EA~250-250ml|水煮|油盐未知`);
  const [hd1PromptMessage, setHd1PromptMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [draft, setDraft] = useState<ParsedMeal | ConfirmedMeal>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const hd1AiPrompt = useMemo(() => createHd1AiPrompt(today), [today]);
  const hd1ImagePrompt = createHd1ImagePrompt(localDateTime());
  const favoriteFoodIds = useMemo(
    () => Array.isArray(storedFavoriteFoodIds)
      ? storedFavoriteFoodIds.filter((value): value is string => typeof value === "string")
      : [],
    [storedFavoriteFoodIds]
  );
  const favoriteFoods = useMemo(
    () => favoriteFoodIds
      .map((id) => foods.find((food) => food.id === id))
      .filter((food): food is FoodReference => food !== undefined && !isHiddenBuiltInFallbackFood(food)),
    [favoriteFoodIds, foods]
  );
  const recentFoods = useMemo(
    () => recentFoodIds(recentMeals)
      .map((id) => foods.find((food) => food.id === id))
      .filter((food): food is FoodReference => food !== undefined && !isHiddenBuiltInFallbackFood(food)),
    [foods, recentMeals]
  );
  const currentTargets = useMemo(() => profile ? calculateTargets(profile) : undefined, [profile]);
  const targets = useMemo(
    () => currentTargets
      ? applyCurrentSafetyAdmission(
          resolveDailyTargets(meals, storedDayTarget, currentTargets),
          currentTargets
        )
      : undefined,
    [currentTargets, meals, storedDayTarget]
  );
  const assessment = useMemo(() => targets ? assessDay(today, mealFacts(meals, foods), targets, { completed, waterMl }) : undefined, [completed, foods, meals, targets, today, waterMl]);

  const scrollToMealEditor = () => {
    requestAnimationFrame(() => {
      document.getElementById("meal-draft-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openDraft = (nextDraft: ParsedMeal | ConfirmedMeal, nextMessage: string) => {
    setDraft(nextDraft);
    setErrors([]);
    setMessage(nextMessage);
    scrollToMealEditor();
  };

  const parse = () => {
    const result = parseHd1(rawLine);
    if (!result.ok) {
      setErrors(result.errors);
      setDraft(undefined);
      return;
    }
    openDraft(result.value, "");
  };

  const copyHd1Prompt = async (prompt: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setHd1PromptMessage(successMessage);
    } catch {
      setHd1PromptMessage("浏览器未允许复制，请展开对应 Prompt 后手动选择文本。");
    }
  };

  const save = async () => {
    if (!draft || !currentTargets) return;
    const validationErrors = validateMealDraft(draft);
    if (validationErrors.length > 0) {
      setMessage(validationErrors.join(" "));
      return;
    }
    setSaving(true);
    try {
      const storedTarget = draft.date === today
        ? storedDayTarget
        : await getSetting<unknown>(`dayTarget:${draft.date}`, undefined);
      const targetSnapshot = resolveDailyTargets([], storedTarget, currentTargets);
      const now = new Date().toISOString();
      const mealWithoutNutrition: ConfirmedMeal = "id" in draft ? {
        ...draft,
        ruleSetVersion: targetSnapshot.ruleSetVersion,
        targetSnapshot,
        updatedAt: now
      } : {
        ...draft,
        id: crypto.randomUUID(),
        ruleSetVersion: targetSnapshot.ruleSetVersion,
        targetSnapshot,
        createdAt: now,
        updatedAt: now
      };
      const meal: ConfirmedMeal = {
        ...mealWithoutNutrition,
        nutritionSnapshot: calculateNutrition(mealWithoutNutrition, foods),
        nutritionSnapshotOrigin: "CONFIRMED"
      };
      await saveConfirmedMeal(meal);
      setDraft(undefined);
      setMessage(meal.date === today ? "已保存到本机。" : `已保存到 ${meal.date}，可在周总结中查看。`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <PageIntro eyebrow="开始使用" title="先建立你的每日目标" description="填写身高、体重和活动强度后，才能按书中规则评价餐食。"><NavLink className="primary button-link" to="/calculator">去填写资料</NavLink></PageIntro>;
  }

  return (
    <div className="page-stack today-page">
      <PageIntro eyebrow={today} title={`今天，${profile.name || "给自己吃好一点"}`} description="记录事实，看到缺口，再决定下一餐。所有数据只保存在这台设备。" />
      <QuickMealCard
        foods={foods}
        favoriteFoodIds={favoriteFoodIds}
        favoriteFoods={favoriteFoods}
        recentFoods={recentFoods}
        draft={draft}
        onAdd={(food, eatenAt, mealType, unknownOil, unknownSalt) => {
          const nextDraft = draft
            ? appendQuickMealFood(draft, food)
            : createQuickMealDraft(food, eatenAt, mealType, unknownOil, unknownSalt);
          setDraft(nextDraft);
          setErrors([]);
          setMessage(`已加入“${food.name}”，本餐共 ${nextDraft.items.length} 项。`);
        }}
        onToggleFavorite={(foodId) => {
          const next = favoriteFoodIds.includes(foodId)
            ? favoriteFoodIds.filter((id) => id !== foodId)
            : [...favoriteFoodIds, foodId];
          void setSetting("favoriteFoodIds", next).catch((error) => setMessage(errorMessage(error)));
        }}
        onRemoveDraftItem={(tempId) => {
          setDraft((current) => {
            if (!current) return undefined;
            const items = current.items.filter((item) => item.tempId !== tempId);
            return items.length > 0 ? { ...current, items } : undefined;
          });
          setErrors([]);
          setMessage("");
        }}
        onClearDraft={() => {
          setDraft(undefined);
          setErrors([]);
          setMessage("");
        }}
        onReviewDraft={scrollToMealEditor}
      />
      {draft && <MealDraftEditor draft={draft} foods={foods} onChange={setDraft} onCancel={() => setDraft(undefined)} onSave={() => void save()} saving={saving} />}
      {message && <p className="notice success">{message}</p>}
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">今日记录</span><h2>{meals.length} 餐 · {meals.reduce((sum, meal) => sum + meal.items.length, 0)} 项食物</h2></div></div>
        {meals.length === 0 ? <EmptyState text="还没有餐食记录。" /> : (
          <div className="meal-list">
            {meals.map((meal) => <MealRow
              key={meal.id}
              meal={meal}
              facts={nutritionFactsForMeal(meal, foods)}
              onRepeat={() => {
                openDraft(createRepeatMealDraft(meal, localDateTime()), "已复制餐食，请确认时间、内容和重量后保存。");
              }}
              onEdit={() => openDraft(meal, "正在编辑已有餐食，保存后会更新原记录。")}
              onDelete={async () => { if (!confirm("删除这条餐食记录？")) return; try { await deleteMeal(meal.id); } catch (error) { setMessage(errorMessage(error)); } }}
            />)}
          </div>
        )}
        <div className="daily-controls">
          <label>饮水（ml）<input type="number" min="0" step="100" value={waterMl} onChange={(event) => void setSetting(`water:${today}`, number(event.target.value))} /></label>
          <label className="checkbox complete-toggle"><input
            type="checkbox"
            checked={completed}
            disabled={meals.length === 0 && !completed}
            onChange={async (event) => {
              try {
                await setDayCompletion(today, event.target.checked);
                setMessage(event.target.checked ? "今天已标记为记录完整。" : "已取消完整标记。");
              } catch (error) {
                setMessage(errorMessage(error));
              }
            }}
          /><span><b>今天已记录完整</b><small>餐食发生变化后会自动取消，需重新确认</small></span></label>
        </div>
      </section>
      {assessment && meals.length > 0 && <AssessmentPanel assessment={assessment} />}
      <details className="card today-more-tools">
        <summary><span><b>其他记餐方式</b><small>常用搭配、组合餐估算与 HD1 导入</small></span><span className="step-pill">按需展开</span></summary>
        <div className="today-more-tools-body">
      <section className="today-tool-section">
        <div className="section-heading"><div><span className="eyebrow">常用搭配</span><h2>点一下生成可编辑草稿</h2></div><span className="step-pill">示例份量</span></div>
        <p className="helper">模板只提供记录起点，不是书本目标或个性化推荐；保存前请确认实际食物、重量和油盐。</p>
        <div className="template-grid">
          {MEAL_TEMPLATES.map((template) => (
            <button className="template-button" type="button" key={template.id} onClick={() => {
              openDraft(createMealDraftFromTemplate(template, localDateTime()), "已生成“" + template.name + "”草稿，请按实际情况修改后保存。");
            }}><strong>{template.name}</strong><span>{template.description}</span></button>
          ))}
        </div>
      </section>
      <MixedMealEstimatorCard embedded onCreate={(nextDraft, label) => {
        openDraft(nextDraft, `已生成“${label}”估算草稿，请按实际情况修改后保存。`);
      }} />
      <section className="today-tool-section">
        <div className="section-heading"><div><span className="eyebrow">HD1 导入</span><h2>粘贴一行餐食</h2></div><span className="step-pill">先解析，再确认</span></div>
        <details className="hd1-ai-help">
          <summary><span><b>让任意 AI 帮我生成</b><small>复制完整 Prompt，不需要记住 DA、EA 等代码</small></span><span className="step-pill">展开</span></summary>
          <div className="hd1-ai-help-body">
            <p className="helper">把 Prompt 发给 ChatGPT、Claude、DeepSeek、豆包等 AI，再补充你实际吃了什么。AI 生成后仍需在本应用中人工确认食物、状态和重量。</p>
            <div className="hd1-prompt-actions">
              <button className="secondary" type="button" onClick={() => void copyHd1Prompt(hd1AiPrompt, "文字描述 Prompt 已复制，可以直接粘贴给 AI。")}>复制文字描述 Prompt</button>
              <button className="secondary" type="button" onClick={() => void copyHd1Prompt(createHd1ImagePrompt(localDateTime()), "照片识别 Prompt 已复制，请和餐食照片一起发送给 AI。")}>复制餐食照片 Prompt</button>
            </div>
            <p className="hd1-photo-hint">照片模式适用于支持图片识别的 AI。AI 会直接估计并生成草稿；粘贴回来后请点击“解析并人工确认”进行修改。</p>
            {hd1PromptMessage && <p className="notice success">{hd1PromptMessage}</p>}
            <details className="hd1-prompt-text">
              <summary>查看文字描述 Prompt</summary>
              <pre>{hd1AiPrompt}</pre>
            </details>
            <details className="hd1-prompt-text">
              <summary>查看餐食照片 Prompt</summary>
              <pre>{hd1ImagePrompt}</pre>
            </details>
            <details className="hd1-code-help">
              <summary>查看字段代码</summary>
              <div className="hd1-code-groups">
                <div><b>餐次</b>{Object.entries(MEAL_LABELS).map(([code, label]) => <span key={code}><code>{code}</code>{label}</span>)}</div>
                <div><b>食物分类</b>{FOOD_CATEGORIES.map((code) => <span key={code}><code>{code}</code>{CATEGORY_LABELS[code]}</span>)}</div>
                <div><b>食物状态</b>{FOOD_STATES.map((code) => <span key={code}><code>{code}</code>{FOOD_STATE_LABELS[code]}</span>)}</div>
                <div><b>单位</b><span><code>g</code>克</span><span><code>ml</code>毫升</span><span><code>pc</code>个</span></div>
              </div>
            </details>
            <div className="hd1-example"><b>示例</b><code>HD1|{today.replaceAll("-", "")}-1230|L|米饭~GR~CK~150-150g;西兰花~DV~CK~100-100g;鸡胸肉~MP~CK~80-80g|清炒|油盐未知</code></div>
          </div>
        </details>
        <textarea className="hd1-input" rows={5} value={rawLine} onChange={(event) => setRawLine(event.target.value)} spellCheck={false} />
        <p className="helper">格式：HD1|日期时间|餐次|名称~分类~状态~重量范围|烹调|备注</p>
        {errors.map((error) => <p className="notice error" key={error}>{error}</p>)}
        <button className="primary full-width" type="button" onClick={parse}>解析并人工确认</button>
      </section>
        </div>
      </details>
    </div>
  );
}

function mealNutrientValue(facts: NutritionFacts, key: NutrientKey, unit: string, digits = 0): string {
  const coverage = facts.nutrientCoverage?.[key];
  const hasKnownValue = coverage ? coverage.knownItemCount > 0 : facts.knownItemCount > 0;
  return hasKnownValue ? formatRange(facts.totals.min[key], facts.totals.max[key], unit, digits) : "未知";
}

function itemNutritionText(item: NutritionFacts["items"][number]): string {
  const isKnown = (key: NutrientKey) => item.knownNutrients?.includes(key) ?? true;
  return [
    isKnown("kcal") ? `能量 ${formatRange(item.nutrients.min.kcal, item.nutrients.max.kcal, "kcal")}` : undefined,
    isKnown("protein") ? `蛋白质 ${formatRange(item.nutrients.min.protein, item.nutrients.max.protein, "g", 1)}` : undefined,
    isKnown("carb") ? `碳水 ${formatRange(item.nutrients.min.carb, item.nutrients.max.carb, "g", 1)}` : undefined,
    isKnown("fat") ? `脂肪 ${formatRange(item.nutrients.min.fat, item.nutrients.max.fat, "g", 1)}` : undefined,
    isKnown("fiber") ? `纤维 ${formatRange(item.nutrients.min.fiber, item.nutrients.max.fiber, "g", 1)}` : undefined
  ].filter((value): value is string => Boolean(value)).join(" · ") || "当前营养项未知";
}

export function MealRow({ meal, facts, onRepeat, onEdit, onDelete }: { meal: ConfirmedMeal; facts?: NutritionFacts; onRepeat?: () => void; onEdit: () => void; onDelete: () => void | Promise<void> }) {
  const hasKnownNutrition = Boolean(facts && facts.knownItemCount > 0);
  const isKnownSubtotal = Boolean(facts && (!facts.complete || facts.unknownItems.length > 0 || meal.unknownOil));
  return (
    <article className="meal-row">
      <div className="meal-time"><b>{meal.eatenAt.slice(11, 16)}</b><span>{MEAL_LABELS[meal.mealType]}</span></div>
      <div className="meal-content">
        <h3>{meal.items.map((item) => item.name).join("、")}{meal.nutritionSnapshotOrigin === "MIGRATED" && <span className="tag">升级时估算</span>}</h3>
        <p>{meal.items.map((item) => `${item.quantityMin === item.quantityMax ? item.quantityMin : `${item.quantityMin}～${item.quantityMax}`}${item.unit}`).join(" · ")}</p>
        {facts && <div className="meal-nutrition">
          <div className="meal-nutrition-bar">
            {hasKnownNutrition ? <>
              {isKnownSubtotal && <span className="nutrition-status">{meal.unknownOil ? "已知小计 · 用油未计" : "已知小计"}</span>}
              <strong>{mealNutrientValue(facts, "kcal", "kcal")}</strong>
              <span><small>蛋白</small>{mealNutrientValue(facts, "protein", "g", 1)}</span>
              <span><small>碳水</small>{mealNutrientValue(facts, "carb", "g", 1)}</span>
              <span><small>脂肪</small>{mealNutrientValue(facts, "fat", "g", 1)}</span>
            </> : <span className="meal-nutrition-empty">暂无可计算营养</span>}
            <details className="meal-nutrition-details">
              <summary>{hasKnownNutrition ? "明细" : "查看原因"}</summary>
              <div className="meal-nutrition-detail-body">
                {meal.nutritionSnapshotOrigin === "MIGRATED" && <p className="migration-note">营养快照按升级或旧备份恢复当时的食物库估算；重新确认保存后会更新来源。</p>}
                {facts.items.map((item) => <div className="meal-nutrition-item" key={item.tempId}>
                  <b>{item.name}</b>
                  <span>{itemNutritionText(item)}</span>
                  <small>数据来源：{item.sourceRef}</small>
                </div>)}
                {facts.unknownItems.map((item) => <div className="meal-nutrition-item unknown" key={item.tempId}>
                  <b>{item.name}</b><span>无法计算：{item.reason}</span>
                </div>)}
              </div>
            </details>
          </div>
        </div>}
        {!facts && meal.nutritionSnapshotOrigin === "MIGRATED" && <details className="meal-nutrition-details migration-only"><summary>升级时估算说明</summary><p className="migration-note">营养快照按升级或旧备份恢复当时的食物库估算；重新确认保存后会更新来源。</p></details>}
      </div>
      <div className="row-actions">{onRepeat && <button className="text-button" type="button" onClick={onRepeat}>再记一次</button>}<button className="text-button" type="button" onClick={onEdit}>编辑</button><button className="text-button danger" type="button" onClick={() => void onDelete()}>删除</button></div>
    </article>
  );
}

function ProfileEditor({ showTitle = true, onSaved }: { showTitle?: boolean; onSaved?: (profile: UserProfile) => void }) {
  const { profile, saveProfile } = useApp();
  const [form, setForm] = useState(() => defaultProfile(profile));
  const [message, setMessage] = useState("");

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = { ...form, updatedAt: new Date().toISOString() };
      calculateTargets(next);
      await saveProfile(next);
      setMessage("个人资料已保存。 ");
      onSaved?.(next);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      {showTitle && <div className="section-heading"><div><span className="eyebrow">计算依据</span><h2>个人资料</h2></div></div>}
      <div className="form-grid two-columns">
        <label>称呼（可选）<input value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>出生日期<input type="date" max={localDateKey()} value={form.birthDate ?? ""} onChange={(event) => setForm({ ...form, birthDate: event.target.value || undefined })} /></label>
        <label>身高（cm）<input required type="number" min="106" max="250" step="0.1" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: number(event.target.value) })} /></label>
        <label>当前体重（kg）<input required type="number" min="20" max="300" step="0.1" value={form.currentWeightKg} onChange={(event) => setForm({ ...form, currentWeightKg: number(event.target.value) })} /></label>
        <label>活动强度
          <select value={form.activityLevel} onChange={(event) => setForm({ ...form, activityLevel: event.target.value as ActivityLevel })}>
            {ACTIVITY_LEVELS.map((level) => <option key={level} value={level}>{ACTIVITY_LABELS[level]}</option>)}
          </select>
        </label>
        <label>性别（仅记录）
          <select value={form.sex ?? "UNSPECIFIED"} onChange={(event) => setForm({ ...form, sex: event.target.value as UserProfile["sex"] })}>
            <option value="UNSPECIFIED">不指定</option><option value="F">女</option><option value="M">男</option>
          </select>
        </label>
        <label>日常饮食模式
          <select value={form.dietPattern ?? ""} onChange={(event) => setForm({ ...form, dietPattern: event.target.value ? event.target.value as UserProfile["dietPattern"] : undefined })}>
            <option value="">请选择</option><option value="OMNIVORE">杂食</option><option value="VEGETARIAN">蛋奶素/素食</option><option value="VEGAN">纯素</option><option value="OTHER">其他</option>
          </select>
        </label>
        <label>日常运动
          <select value={form.dailyExercise ?? ""} onChange={(event) => setForm({ ...form, dailyExercise: event.target.value ? event.target.value as UserProfile["dailyExercise"] : undefined })}>
            <option value="">请选择</option><option value="NONE">不运动/未安排</option><option value="LIGHT">轻量</option><option value="MODERATE">中等</option><option value="VIGOROUS">高强度</option>
          </select>
        </label>
        <label>饮食习惯简述<input placeholder="如：三餐规律、常外卖" value={form.dietHabitSummary ?? ""} onChange={(event) => setForm({ ...form, dietHabitSummary: event.target.value || undefined })} /></label>
      </div>
      <label className="checkbox"><input type="checkbox" checked={form.overweightAdjustmentEnabled} onChange={(event) => setForm({ ...form, overweightAdjustmentEnabled: event.target.checked })} /><span><b>手动采用超重调整</b><small>仅在轻体力活动时，把系数从30调整为25；不会自动判断。</small></span></label>
      <fieldset className="health-flags"><legend>安全提示条件（可多选）</legend>{HEALTH_FLAGS.map((flag) => <label className="checkbox" key={flag.value}><input type="checkbox" checked={form.healthFlags.includes(flag.value)} onChange={(event) => setForm({ ...form, healthFlags: event.target.checked ? [...form.healthFlags, flag.value] : form.healthFlags.filter((value) => value !== flag.value) })} />{flag.label}</label>)}</fieldset>
      {message && <p className="notice">{message.trim()}</p>}
      <button className="primary full-width" type="submit">保存并计算</button>
    </form>
  );
}

function CalculatorPage() {
  const { profile } = useApp();
  const targets = profile ? calculateTargets(profile) : undefined;
  return (
    <div className="page-stack">
      <PageIntro eyebrow="书本计算器" title="把身高和工作强度变成每日目标" description="标准体重 = 身高 − 105；能量 = 标准体重 × 活动系数。结果用于普通成年人日常饮食自查。" />
      <ProfileEditor />
      {targets && (
        <>
          {targets.safetyRestricted ? <section className="card result-card">
            <span className="eyebrow">自动建议已暂停</span>
            <h2>当前只保留记录功能</h2>
            <p>请先补全健康模式资料，或就已勾选的特殊情况咨询医生/注册营养师。本页不展示追赶式能量和宏量目标。</p>
            {targets.safetyMessages.map((message) => <p className="notice warning" key={message}>{message}</p>)}
          </section> : <section className="card result-card">
            <span className="eyebrow">你的每日目标</span>
            <div className="big-result"><strong>{targets.energyKcal.toFixed(0)}</strong><span>kcal / 天</span></div>
            <p>{targets.standardWeightKg.toFixed(1)} kg 标准体重 × {targets.activityFactor} kcal/kg</p>
            <div className="macro-grid">
              <div><span>碳水 55%</span><b>{targets.carbG.toFixed(1)} g</b></div>
              <div><span>蛋白质 15%</span><b>{targets.proteinG.toFixed(1)} g</b></div>
              <div><span>脂肪 30%</span><b>{targets.fatG.toFixed(1)} g</b></div>
            </div>
            <dl className="result-list">
              <div><dt>蛋白质交叉检查</dt><dd>{formatRange(targets.proteinCrossCheck.min, targets.proteinCrossCheck.max, "g", 1)} · {targets.proteinCrossCheckStatus === "LOW" ? "15%口径偏低" : targets.proteinCrossCheckStatus === "HIGH" ? "15%口径偏高" : "两个口径一致"}</dd></div>
              <div><dt>动物/植物蛋白分配</dt><dd>各约 {targets.animalProteinG.toFixed(1)} g</dd></div>
              <div><dt>早餐能量范围</dt><dd>{formatRange(targets.breakfastEnergy.min, targets.breakfastEnergy.max, "kcal")}</dd></div>
            </dl>
          </section>}
          <section className="card">
            <div className="section-heading"><div><span className="eyebrow">来源追踪</span><h2>采用的书本规则</h2></div></div>
            <ul className="rule-list">
              <li><b>BR-E-001</b><span>第一册“能量平衡的方法因人而异”：标准体重 = 身高 − 105 · <NavLink className="inline-link" to="/book/B1-ENERGY">查看章节</NavLink></span></li>
              <li><b>BR-E-002</b><span>同章：按劳动/活动强度选择每公斤能量系数 · <NavLink className="inline-link" to="/book/B1-ENERGY">查看章节</NavLink></span></li>
              <li><b>BR-E-003</b><span>同章：超重且轻体力时可手动把系数从30调整为25 · <NavLink className="inline-link" to="/book/B1-ENERGY">查看章节</NavLink></span></li>
              <li><b>BR-M-001</b><span>同章：碳水、蛋白质、脂肪按 55% / 15% / 30% 分配 · <NavLink className="inline-link" to="/book/B1-ENERGY">查看章节</NavLink></span></li>
              <li><b>BR-M-002</b><span>第一册“早餐一定要吃够100分”的175厘米案例：每公斤1～1.2克蛋白质交叉检查 · <NavLink className="inline-link" to="/book/B1-BREAKFAST">查看章节</NavLink></span></li>
            </ul>
            <details><summary>书中案例验算</summary><p>175 cm 轻体力：70 × 30 = 2100 kcal；178 cm 电脑工作：73 × 30 = 2190 kcal；185 cm 程序员：80 × 30 = 2400 kcal。</p></details>
          </section>
        </>
      )}
    </div>
  );
}

const BOOK_SOURCE_KIND_LABELS: Record<BookKnowledgeSourceKind, string> = {
  BOOK_DIRECT: "书中明确",
  BOOK_CASE: "书中案例",
  APP_DERIVED: "应用推导",
  SAFETY: "安全提示"
};

const BOOK_KNOWLEDGE_CATEGORY_LABELS: Record<BookKnowledgeCategory, string> = {
  NUTRIENT: "营养素基础",
  MICRONUTRIENT: "维生素与矿物质",
  FOOD_SELECTION: "食物选择",
  MEAL_PLANNING: "一日搭配",
  RECORD_SAFETY: "记录与安全"
};

function KnowledgeSourceChip({ kind }: { kind: BookKnowledgeSourceKind }) {
  return <small className={`knowledge-source-chip source-${kind.toLowerCase()}`}>{BOOK_SOURCE_KIND_LABELS[kind]}</small>;
}

function KnowledgeList({ items }: { items: BookKnowledgeItem[] }) {
  return <ul className="knowledge-list">{items.map((item) => <li key={`${item.sourceKind}:${item.text}`}><span>{item.text}</span><KnowledgeSourceChip kind={item.sourceKind} /></li>)}</ul>;
}

export function BookChapterCard({ chapter }: { chapter: BookChapterKnowledge }) {
  return (
    <article className="card book-chapter-card">
      <NavLink className="book-chapter-link" to={`/book/${chapter.id}`}>
        <h2>{chapter.source.chapterTitle}</h2>
        <span aria-hidden="true">→</span>
      </NavLink>
    </article>
  );
}

function BookKnowledgePage() {
  const [query, setQuery] = useState("");
  const [book, setBook] = useState<"ALL" | "BOOK_1" | "BOOK_2">("ALL");
  const [category, setCategory] = useState<"ALL" | BookKnowledgeCategory>("ALL");
  const normalizedQuery = normalizedFoodSearch(query);
  const chapters = BOOK_CHAPTERS.filter((chapter) => {
    if (book !== "ALL" && chapter.source.bookId !== book) return false;
    if (category !== "ALL" && chapter.category !== category) return false;
    if (!normalizedQuery) return true;
    return normalizedFoodSearch([
      chapter.source.chapterTitle,
      chapter.source.part,
      chapter.coreIdea,
      BOOK_KNOWLEDGE_CATEGORY_LABELS[chapter.category],
      chapter.id,
      ...chapter.knowledgePoints.map((item) => item.text),
      ...(chapter.decisionRules ?? []).map((item) => item.text),
      ...(chapter.bookExamples ?? []).map((item) => item.text),
      ...(chapter.commonMisuses ?? []).map((item) => item.text),
      ...(chapter.appNotes ?? []).map((item) => item.text),
      ...chapter.relatedRuleIds
    ].join(" ")).includes(normalizedQuery);
  });

  return (
    <div className="page-stack">
      <PageIntro eyebrow="两本书的核心内容" title="核心饮食知识" description="从七大营养素、维生素与矿物质，到食物选择和一日搭配；内容以书中真正有用的知识为主，计算规则只是其中一部分。" />
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">章节查找</span><h2>核心知识目录</h2></div><span className="count-badge">{chapters.length} 章</span></div>
        <div className="compact-grid book-filters">
          <label>搜索章节或规则<input value={query} placeholder="如：早餐、饮水、BR-F-003" onChange={(event) => setQuery(event.target.value)} /></label>
          <label>书籍<select value={book} onChange={(event) => setBook(event.target.value as typeof book)}>
            <option value="ALL">两本书</option>
            <option value="BOOK_1">你是你吃出来的</option>
            <option value="BOOK_2">你是你吃出来的2</option>
          </select></label>
          <label>知识分类<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            <option value="ALL">全部分类</option>
            {Object.entries(BOOK_KNOWLEDGE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <p className="helper">这两本 EPUB 没有纸书页码映射，因此应用显示目录序号和约全书百分比，不伪造“第几页”。</p>
      </section>
      <div className="book-chapter-grid">
        {chapters.map((chapter) => <BookChapterCard chapter={chapter} key={chapter.id} />)}
      </div>
      {chapters.length === 0 && <EmptyState text="没有找到匹配章节。" />}
    </div>
  );
}

function BookChapterPage() {
  const { chapterId = "" } = useParams();
  const chapter = findBookChapter(chapterId);
  if (!chapter) return <Navigate replace to="/book" />;

  const primaryItems = chapter.decisionRules ?? chapter.knowledgePoints;
  const primaryPreview = primaryItems.slice(0, 4);
  const remainingPrimary = primaryItems.slice(4);
  const mechanismItems = chapter.decisionRules ? chapter.knowledgePoints : [];
  const boundaryItem = chapter.cautions?.[0] ?? chapter.commonMisuses?.[0];
  const remainingCautions = chapter.cautions?.slice(1);
  const remainingMisuses = chapter.cautions ? chapter.commonMisuses : chapter.commonMisuses?.slice(1);

  return (
    <div className="page-stack">
      <NavLink className="back-link" to="/book">← 返回书本知识</NavLink>
      <PageIntro eyebrow={`${chapter.source.bookId === "BOOK_1" ? "第一册" : "第二册"} · ${chapter.source.part}`} title={chapter.source.chapterTitle} description={chapter.coreIdea} />
      <div className="knowledge-core-source"><KnowledgeSourceChip kind={chapter.coreIdeaSource} /></div>
      <section className="card book-knowledge-section knowledge-priority-card">
        <span className="eyebrow">{chapter.decisionRules ? "先按这些规则判断" : "先记住这些重点"}</span>
        <KnowledgeList items={primaryPreview} />
      </section>
      {boundaryItem && <section className="card book-misuse-card knowledge-boundary-card">
        <span className="eyebrow">先注意这个边界</span>
        <KnowledgeList items={[boundaryItem]} />
      </section>}
      <details className="card knowledge-disclosure">
        <summary>展开原理、案例与完整来源</summary>
        <div className="knowledge-disclosure-body">
          {mechanismItems.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">为什么这样做</span><KnowledgeList items={mechanismItems} /></section>}
          {remainingPrimary.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">更多判断要点</span><KnowledgeList items={remainingPrimary} /></section>}
          {chapter.bookExamples && <section className="book-knowledge-section"><span className="eyebrow">书中数据与案例</span><KnowledgeList items={chapter.bookExamples} /></section>}
          {remainingMisuses && remainingMisuses.length > 0 && <section className="book-knowledge-section book-misuse-section"><span className="eyebrow">其他容易用错的地方</span><KnowledgeList items={remainingMisuses} /></section>}
          {chapter.appNotes && <section className="book-knowledge-section"><span className="eyebrow">应用如何使用</span><KnowledgeList items={chapter.appNotes} /></section>}
          {remainingCautions && remainingCautions.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">其他适用边界</span><KnowledgeList items={remainingCautions} /></section>}
          <section className="book-source-card">
            <span className="eyebrow">引用位置</span>
            <h2>{chapter.source.bookTitle}</h2>
            <p>{bookLocationLabel(chapter.source)}</p>
            {chapter.source.sourceKeywords && <p>原文定位关键词：{chapter.source.sourceKeywords.join(" · ")}</p>}
            <p className="helper">内部定位：<code>{chapter.source.epubFile}</code>{chapter.source.epubAnchor ? <> · 锚点：<code>{chapter.source.epubAnchor}</code></> : null} · 最近核对：{chapter.source.verifiedAt} · 纸书页码：该 EPUB 未提供</p>
          </section>
        </div>
      </details>
      <section className="card"><span className="eyebrow">关联规则</span><div className="book-rule-links">{chapter.relatedRuleIds.map((ruleId) => <code key={ruleId}>{ruleId}</code>)}</div></section>
    </div>
  );
}
export function WeeklyActionsPanel({
  week,
  targets
}: { week: WeeklyAssessment; targets: DailyTargets }) {
  if (targets.safetyRestricted) {
    return <section className="card">
      <div className="section-heading"><div><span className="eyebrow">安全提示</span><h2>普通建议已暂停</h2></div></div>
      <p>当前周总结只展示历史摄入事实和记录覆盖，不提供目标比较或饮食调整建议。</p>
      {targets.safetyMessages.map((message) => <p className="notice warning" key={message}>{message}</p>)}
    </section>;
  }

  return <section className="card">
    <div className="section-heading"><div><span className="eyebrow">下周行动</span><h2>先解决最重要的问题</h2></div></div>
    {week.issues.length ? <ol className="issue-list">{week.issues.slice(0, 3).map((issue) => <li key={issue}>{issue}</li>)}</ol> : <p>当前记录未发现优先级更高的问题，继续保持完整记录和食材轮换。</p>}
  </section>;
}


function HistoryPage() {
  const { profile } = useApp();
  const foods = useFoodReferences();
  const start = dateOffset(-6);
  const end = localDateKey();
  const [selectedDate, setSelectedDate] = useState(end);
  const meals = useLiveQuery(() => loadMealsBetween(start, end), [start, end], []);
  const selectedMeals = useLiveQuery(() => loadMealsForDate(selectedDate), [selectedDate], []);
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy("measuredAt").toArray(), [], []);
  const [draft, setDraft] = useState<ConfirmedMeal>();
  const [saving, setSaving] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const currentTargets = profile ? calculateTargets(profile) : undefined;
  const dates = Array.from({ length: 7 }, (_, index) => dateOffset(index - 6));
  const completedMap = new Map(dates.map((date) => [date, completedFromSettings(settings, date)]));
  const selectedCompleted = completedFromSettings(settings, selectedDate);
  const waterMap = new Map(settings.filter((item) => item.key.startsWith("water:")).map((item) => [item.key.slice(6), Number(item.value)]));
  const days = currentTargets ? dates.map((date) => {
    const dateMeals = meals.filter((meal) => meal.date === date);
    const dayTargets = applyCurrentSafetyAdmission(
      resolveDailyTargets(
        dateMeals,
        settingValue(settings, `dayTarget:${date}`),
        currentTargets
      ),
      currentTargets
    );
    return assessDay(date, mealFacts(dateMeals, foods), dayTargets, { completed: completedMap.get(date) ?? false, waterMl: waterMap.get(date) ?? 0 });
  }) : [];
  const week = currentTargets ? assessWeek(start, end, days, metrics) : undefined;
  const waistMetrics = metrics.filter((item) => {
    const date = item.measuredAt.slice(0, 10);
    return item.waistCm !== undefined && date >= start && date <= end;
  });
  const latestWaist = waistMetrics.at(-1)?.waistCm;
  const previousWaist = waistMetrics.at(-2)?.waistCm;
  const waistChange = latestWaist !== undefined && previousWaist !== undefined
    ? latestWaist - previousWaist
    : undefined;

  const saveEdit = async () => {
    if (!draft || !currentTargets) return;
    const validationErrors = validateMealDraft(draft);
    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      return;
    }
    setSaving(true);
    try {
      const targetSnapshot = resolveDailyTargets(
        [],
        settingValue(settings, `dayTarget:${draft.date}`),
        currentTargets
      );
      const mealWithoutNutrition: ConfirmedMeal = {
        ...draft,
        ruleSetVersion: targetSnapshot.ruleSetVersion,
        targetSnapshot,
        updatedAt: new Date().toISOString()
      };
      await saveConfirmedMeal({
        ...mealWithoutNutrition,
        nutritionSnapshot: calculateNutrition(mealWithoutNutrition, foods),
        nutritionSnapshotOrigin: "CONFIRMED"
      });
      setDraft(undefined);
      setHistoryMessage("历史餐食已保存。");
    } catch (error) {
      setHistoryMessage(errorMessage(error));
    } finally { setSaving(false); }
  };

  if (!profile || !currentTargets || !week) return <PageIntro eyebrow="周总结" title="先填写个人资料" description="有每日目标后才能生成周总结。"><NavLink className="primary button-link" to="/calculator">去填写资料</NavLink></PageIntro>;

  return (
    <div className="page-stack">
      <PageIntro eyebrow={`${start} — ${end}`} title="最近 7 天" description="仅“已记录完整”的日期进入平均值和达标统计。" />
      <section className="card weekly-hero">
        <div><span>有效记录</span><strong>{week.validDays}<small> / 7 天</small></strong></div>
        <div><span>能量 / 蛋白有效</span><strong>{week.nutritionValidDaysByNutrient.kcal}<small> / {week.nutritionValidDaysByNutrient.protein} 天</small></strong></div>
        <div><span>食物种类</span><strong>{week.uniqueFoodCount}<small> 种</small></strong></div>
        {!currentTargets.safetyRestricted && <div><span>早餐达标</span><strong>{week.breakfastPassDays}<small> 天</small></strong></div>}
      </section>
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">周平均</span><h2>摄入区间</h2></div></div>
        <p className="helper">{currentTargets.safetyRestricted ? "安全受限时仅展示各营养素数据完整日的历史事实，不进行目标比较。" : "每项周平均分别使用该营养素数据完整的完成日；鱼肉蛋目标需7天完整且计量口径可比。"}</p>
        {week.averageNutrition ? <div className="status-grid"><div><span>能量</span><b>{week.nutritionValidDaysByNutrient.kcal ? formatRange(week.averageNutrition.min.kcal, week.averageNutrition.max.kcal, "kcal") : "数据不足"}</b></div><div><span>蛋白质</span><b>{week.nutritionValidDaysByNutrient.protein ? formatRange(week.averageNutrition.min.protein, week.averageNutrition.max.protein, "g", 1) : "数据不足"}</b></div><div><span>最近体重变化</span><b>{week.weightChangeKg === undefined ? "记录不足" : `${week.weightChangeKg > 0 ? "+" : ""}${week.weightChangeKg.toFixed(1)} kg`}</b></div><div><span>最近腰围变化</span><b>{waistChange === undefined ? "记录不足" : `${waistChange > 0 ? "+" : ""}${waistChange.toFixed(1)} cm`}</b></div></div> : <EmptyState text="还没有可用于周平均的营养数据。" />}
        <div className="status-grid"><div><span>鱼虾</span><b>{formatWeeklyGroup(week.fishTotal.min, week.fishTotal.max, week.incomparableAnimalGroups.includes("fish"))}</b></div><div><span>畜禽肉</span><b>{formatWeeklyGroup(week.meatTotal.min, week.meatTotal.max, week.incomparableAnimalGroups.includes("meat"))}</b></div><div><span>蛋类</span><b>{formatWeeklyGroup(week.eggTotal.min, week.eggTotal.max, week.incomparableAnimalGroups.includes("egg"))}</b></div></div>
      </section>
      <WeeklyActionsPanel week={week} targets={currentTargets} />
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">按日期管理</span><h2>查看任意日期餐食</h2></div></div>
        <label>选择日期<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        {historyMessage && <p className="notice">{historyMessage}</p>}
        <div className="history-day"><h3>{selectedDate}<span>{completedFromSettings(settings, selectedDate) ? "完整" : "未标记完整"}</span></h3>{selectedMeals.length ? selectedMeals.map((meal) => <MealRow key={meal.id} meal={meal} facts={nutritionFactsForMeal(meal, foods)} onEdit={() => setDraft(meal)} onDelete={async () => { if (!confirm("删除这条餐食记录？")) return; try { await deleteMeal(meal.id); setHistoryMessage("餐食已删除。"); } catch (error) { setHistoryMessage(errorMessage(error)); } }} />) : <p className="muted">该日期无记录</p>}</div>
        <label className="checkbox complete-toggle"><input
          type="checkbox"
          checked={selectedCompleted}
          disabled={selectedMeals.length === 0 && !selectedCompleted}
          onChange={async (event) => {
            try {
              await setDayCompletion(selectedDate, event.target.checked);
              setHistoryMessage(event.target.checked ? `${selectedDate} 已标记为记录完整。` : `${selectedDate} 已取消完整标记。`);
            } catch (error) {
              setHistoryMessage(errorMessage(error));
            }
          }}
        /><span><b>该日已记录完整</b><small>编辑或删除餐食后会自动失效，需重新确认</small></span></label>
      </section>
      {draft && <MealDraftEditor draft={draft} foods={foods} onChange={(next) => setDraft(next as ConfirmedMeal)} onCancel={() => setDraft(undefined)} onSave={() => void saveEdit()} saving={saving} />}
    </div>
  );
}

interface FoodFormState {
  id?: string;
  name: string;
  aliases: string;
  foodKind: FoodKind;
  tags: string;
  beverageSugarProfile: "NONE" | BeverageSugarProfile;
  category: FoodCategory;
  states: FoodState[];
  basisUnit: "g" | "ml";
  kcal: NutrientFormValue;
  protein: NutrientFormValue;
  fat: NutrientFormValue;
  carb: NutrientFormValue;
  fiber: NutrientFormValue;
  gramsPerPiece?: number;
  dataCaveat: string;
}

const EMPTY_FOOD: FoodFormState = {
  name: "",
  aliases: "",
  foodKind: "INGREDIENT",
  tags: "",
  beverageSugarProfile: "NONE",
  category: "OT",
  states: ["EA"],
  basisUnit: "g",
  kcal: "",
  protein: "",
  fat: "",
  carb: "",
  fiber: "",
  dataCaveat: ""
};

function FoodsPage() {
  const foods = useFoodReferences();
  const overrides = useLiveQuery(() => db.foodOverrides.toArray(), [], []);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | FoodKind>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | FoodCategory>("ALL");
  const [form, setForm] = useState<FoodFormState>(EMPTY_FOOD);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const selectableFoods = useMemo(() => foods.filter((food) => !isHiddenBuiltInFallbackFood(food)), [foods]);
  const nutritionCounts = useMemo(() => ({
    complete: selectableFoods.filter((food) => food.nutrientsPer100).length,
    partial: selectableFoods.filter((food) => food.partialNutrientsPer100).length
  }), [selectableFoods]);
  const availableCategories = useMemo(
    () => foodCategoriesForKind(selectableFoods, kindFilter),
    [selectableFoods, kindFilter]
  );
  const visible = selectableFoods.filter((food) => {
    const matchesQuery = !normalizedQuery || [
      food.name,
      ...food.aliases,
      ...(food.tags ?? []),
      ...(food.beverageSugarProfile ? [BEVERAGE_SUGAR_PROFILE_LABELS[food.beverageSugarProfile]] : [])
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
    return matchesQuery
      && (kindFilter === "ALL" || resolveFoodKind(food) === kindFilter)
      && (categoryFilter === "ALL" || food.category === categoryFilter);
  });

  const scrollToFoodEditor = () => {
    requestAnimationFrame(() => {
      document.getElementById("food-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const startAdding = () => {
    setForm({ ...EMPTY_FOOD, states: [...EMPTY_FOOD.states] });
    setMessage("");
    setEditing(true);
    scrollToFoodEditor();
  };

  const edit = (food: FoodReference) => {
    setForm({
      id: food.id,
      name: food.name,
      aliases: food.aliases.join("、"),
      foodKind: resolveFoodKind(food),
      tags: (food.tags ?? []).join("、"),
      beverageSugarProfile: food.beverageSugarProfile ?? "NONE",
      category: food.category,
      states: food.compatibleStates,
      basisUnit: food.basisUnit,
      ...nutrientsToFormValues(food),
      gramsPerPiece: food.gramsPerPiece,
      dataCaveat: (food.dataCaveats ?? []).join("；")
    });
    setMessage("");
    setEditing(true);
    scrollToFoodEditor();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || form.states.length === 0) {
      setMessage("请填写名称并至少选择一种状态。");
      return;
    }
    const food: FoodOverride = {
      id: form.id ?? "user-" + crypto.randomUUID(),
      name: form.name.trim(),
      aliases: form.aliases.split(/[、,，]/).map((value) => value.trim()).filter(Boolean),
      foodKind: form.foodKind,
      tags: form.tags.split(/[、,，]/).map((value) => value.trim()).filter(Boolean),
      beverageSugarProfile: form.beverageSugarProfile === "NONE" ? undefined : form.beverageSugarProfile,
      category: form.category,
      compatibleStates: form.states,
      basisUnit: form.basisUnit,
      gramsPerPiece: form.gramsPerPiece,
      dataCaveats: form.dataCaveat.split(/[；;]/).map((value) => value.trim()).filter(Boolean),
      ...nutrientsFromFormValues({
        kcal: form.kcal, protein: form.protein, fat: form.fat, carb: form.carb, fiber: form.fiber
      }),
      source: { kind: "USER", ref: "用户录入", release: localDateKey(), method: form.foodKind === "PACKAGED" ? "LABEL" : "USER" },
      updatedAt: new Date().toISOString()
    };
    await db.foodOverrides.put(food);
    setMessage("食物数据已作为本地覆盖保存。");
    setForm(EMPTY_FOOD);
    setEditing(false);
  };

  return (
    <div className="page-stack foods-page">
      <PageIntro
        eyebrow={BUILT_IN_FOODS.filter((food) => !isHiddenBuiltInFallbackFood(food)).length + " 种可直接选择食物"}
        title="小型、可追溯的食物库"
        description="基础数据来自美国农业部和中国食物成分公开资料；完整与部分营养值都会明确标记，模糊兜底条目不会伪造数值。"
      >
        <div className="food-page-actions">
          <button className="primary" type="button" onClick={startAdding}>＋ 新增食物</button>
        </div>
      </PageIntro>
      <section className="card food-library-card">
        <div className="food-filters">
          <input className="search-input" type="search" placeholder="搜索名称、别名或标签" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="按食物类型筛选" value={kindFilter} onChange={(event) => {
            const nextKind = event.target.value as "ALL" | FoodKind;
            setKindFilter(nextKind);
            if (
              categoryFilter !== "ALL"
              && !foodCategoriesForKind(selectableFoods, nextKind).includes(categoryFilter)
            ) {
              setCategoryFilter("ALL");
            }
          }}>
            <option value="ALL">全部类型</option>
            {FOOD_KINDS.map((kind) => <option key={kind} value={kind}>{FOOD_KIND_LABELS[kind]}</option>)}
          </select>
          <select aria-label="按食物分类筛选" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "ALL" | FoodCategory)}>
            <option value="ALL">全部分类</option>
            {availableCategories.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
          </select>
        </div>
        <p className="helper food-result-count">显示 {visible.length} / {selectableFoods.length} 条 · 五项完整 {nutritionCounts.complete} · 部分可计算 {nutritionCounts.partial}</p>
        <div className="food-list">
          {visible.map((food) => {
            const overridden = overrides.some((item) => item.id === food.id);
            return (
              <article className="food-row" key={food.id}>
                <div>
                  <h3>
                    {food.name}
                    <span className="tag">{FOOD_KIND_LABELS[resolveFoodKind(food)]}</span>
                    <span className="tag quality-tag">{foodQualityLabel(food)}</span>
                    {food.beverageSugarProfile && <span className="tag">{BEVERAGE_SUGAR_PROFILE_LABELS[food.beverageSugarProfile]}</span>}
                    {overridden && <span className="tag">本地覆盖</span>}
                  </h3>
                  <p>{CATEGORY_LABELS[food.category]} · {formatFoodNutrients(food) ?? "仅记录食物组，营养值未知"}</p>
                  <small>{foodSourceLabel(food)}</small>
                  {food.dataCaveats?.map((caveat) => <p className="data-caveat" key={caveat}>{caveat}</p>)}
                  {food.recipeEstimate && <details className="source-details">
                    <summary>查看估算配方和重量</summary>
                    <p>估算成品 {food.recipeEstimate.finalWeightG} g；{food.recipeEstimate.ingredients.map((ingredient) => `${ingredient.name} ${ingredient.weightG} g`).join("、")}。</p>
                  </details>}
                  <details className="source-details"><summary>查看数据来源</summary><p>
                    {food.source.release} · {food.source.ref.startsWith("https://")
                      ? <a href={food.source.ref} target="_blank" rel="noreferrer">打开来源页</a>
                      : food.source.ref}
                  </p></details>
                </div>
                <button className="text-button" type="button" onClick={() => edit(food)}>编辑</button>
              </article>
            );
          })}
          {visible.length === 0 && <p className="empty-state">没有符合筛选条件的食物。</p>}
        </div>
        <details>
          <summary>术语与数据来源说明</summary>
          <p>常见单品是可直接称重、可使用代表性每100克数据的完整食物，是否经过蒸煮、发酵或油炸不决定分类；组合食品包含需要分别估算的多个主要食材或食物组；包装食品应优先按品牌营养标签记录。</p>
          <p>类型回答“怎样查找和记录”；主食、蔬菜等分类用于书本规则；油炸、含糖、发酵等只作为加工标签，三者互不替代。</p>
          <p>USDA SR28 是美国农业部 2015 年发布的第 28 版食物成分资料。应用中的分类代码用于 HD1 导入和书本规则计算，界面默认展示中文名称。</p>
        </details>
      </section>
      {editing && <form id="food-editor" className="card food-editor-card" onSubmit={(event) => void save(event)}>
        <div className="section-heading"><div><span className="eyebrow">本地覆盖</span><h2>{form.id ? "编辑 " + form.name : "新增食物"}</h2></div><button className="text-button" type="button" onClick={() => setEditing(false)}>取消</button></div>
        <div className="form-grid two-columns">
          <label>名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>别名（顿号分隔）<input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} /></label>
          <label>食物类型<select value={form.foodKind} onChange={(event) => setForm({ ...form, foodKind: event.target.value as FoodKind })}>{FOOD_KINDS.map((kind) => <option key={kind} value={kind}>{FOOD_KIND_LABELS[kind]}</option>)}</select></label>
          <label>分类<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as FoodCategory })}>{FOOD_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>
          <label>饮品糖状态（可选）<select value={form.beverageSugarProfile} onChange={(event) => setForm({ ...form, beverageSugarProfile: event.target.value as "NONE" | BeverageSugarProfile })}><option value="NONE">不适用</option>{BEVERAGE_SUGAR_PROFILES.map((profile) => <option key={profile} value={profile}>{BEVERAGE_SUGAR_PROFILE_LABELS[profile]}</option>)}</select></label>
          <label>标签（顿号分隔）<input value={form.tags} placeholder="例如：早餐、外卖" onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
          <label>每100单位<select value={form.basisUnit} onChange={(event) => setForm({ ...form, basisUnit: event.target.value as "g" | "ml" })}><option value="g">克</option><option value="ml">毫升</option></select></label>
        </div>
        <fieldset className="health-flags"><legend>适用状态</legend>{FOOD_STATES.filter((state) => state !== "UN").map((state) => <label className="checkbox" key={state}><input type="checkbox" checked={form.states.includes(state)} onChange={(event) => setForm({ ...form, states: event.target.checked ? [...form.states, state] : form.states.filter((value) => value !== state) })} />{FOOD_STATE_LABELS[state]}</label>)}</fieldset>
        <p className="helper">每100单位营养值可逐项填写；没有可靠数据的字段请留空，应用不会把空值当作零。</p>
        <div className="form-grid nutrient-inputs">{(["kcal", "protein", "fat", "carb", "fiber"] as const).map((key) => <label key={key}>{({ kcal: "能量 kcal", protein: "蛋白质 g", fat: "脂肪 g", carb: "碳水 g", fiber: "纤维 g" })[key]}<input type="number" min="0" step="0.01" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value === "" ? "" : number(event.target.value) })} /></label>)}<label>每枚克数（可选）<input type="number" min="0" step="0.1" value={form.gramsPerPiece ?? ""} onChange={(event) => setForm({ ...form, gramsPerPiece: event.target.value ? number(event.target.value) : undefined })} /></label></div>
        <label>数据限制或换算说明（可选）<textarea rows={2} value={form.dataCaveat} placeholder="例如：数据来自包装标签；不同口味可能不同" onChange={(event) => setForm({ ...form, dataCaveat: event.target.value })} /></label>
        {message && <p className="notice">{message.trim()}</p>}
        <button className="primary full-width" type="submit">保存本地覆盖</button>
        {form.id && overrides.some((food) => food.id === form.id) && <button className="text-button danger full-width" type="button" onClick={async () => { await db.foodOverrides.delete(form.id!); setEditing(false); }}>删除覆盖并恢复内置值</button>}
      </form>}
    </div>
  );
}

type SyncPreview = InspectedSyncPackage & { importStatus: SyncImportStatus };

const SYNC_IMPORT_LABELS: Record<SyncImportStatus, string> = {
  FIRST_IMPORT: "本机尚无接力基线；恢复会整体替换当前数据。",
  REMOTE_UPDATE: "同步包接续本机基线，且本机没有后续修改。",
  SAME_VERSION: "同步包与本机当前接力版本相同。",
  CONFLICT: "本机数据或版本链已经变化；请先导出本机同步包，再决定是否替换。"
};

function SettingsPage() {
  const { profile } = useApp();
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy("measuredAt").reverse().toArray(), [], []);
  const rollbackBackup = useLiveQuery(() => getSetting<string | undefined>("restoreRollback", undefined), []);
  const localSyncState = useLiveQuery(
    () => getSetting<LocalSyncState | undefined>(SYNC_STATE_KEY, undefined),
    []
  );
  const [metric, setMetric] = useState({ date: localDateKey(), weightKg: profile?.currentWeightKg ?? 70, waistCm: profile?.waistCm ?? 0, note: "" });
  const [syncPassword, setSyncPassword] = useState("");
  const [syncText, setSyncText] = useState("");
  const [syncPreview, setSyncPreview] = useState<SyncPreview>();
  const [syncMessage, setSyncMessage] = useState("");
  const [password, setPassword] = useState("");
  const [backupText, setBackupText] = useState("");
  const [preview, setPreview] = useState<BackupPayload>();
  const [message, setMessage] = useState("");

  const exportSyncPackage = async () => {
    try {
      const created = await createSyncPackage(syncPassword);
      const timestamp = created.package.createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
      downloadTextFile(created.text, `healthier-sync-${timestamp}.hdsync`);
      await acceptSyncBaseline(created.package, created.businessDataHash);
      setSyncMessage("加密同步包已导出，并记录为本机最新接力基线。请在另一台设备导入。 ");
    } catch (error) {
      setSyncMessage(errorMessage(error));
    }
  };

  const inspectSync = async () => {
    try {
      const [inspected, state, currentPayload] = await Promise.all([
        inspectSyncPackage(syncText, syncPassword),
        getLocalSyncState(),
        readBackupPayload()
      ]);
      const currentBusinessDataHash = await calculateBusinessDataHash(currentPayload);
      const importStatus = classifySyncImport(state, currentBusinessDataHash, inspected.package);
      setSyncPreview({ ...inspected, importStatus });
      setSyncMessage(importStatus === "CONFLICT"
        ? "检测到版本冲突。应用不会静默覆盖；请先导出本机同步包留底。 "
        : "同步包已解密并通过业务校验。请确认预览后再恢复。 ");
    } catch (error) {
      setSyncPreview(undefined);
      setSyncMessage(errorMessage(error));
    }
  };

  const restoreSync = async () => {
    if (!syncPreview) return;
    const conflictWarning = syncPreview.importStatus === "CONFLICT"
      ? "检测到冲突。若尚未导出本机同步包，请先取消并留底。\n\n"
      : "";
    if (!confirm(`${conflictWarning}确定用该同步包整体替换本机全部 Healthier 数据？`)) return;
    try {
      await restoreBackup(syncPreview.payload, syncPassword);
      await acceptSyncBaseline(syncPreview.package, syncPreview.businessDataHash);
      location.reload();
    } catch (error) {
      setSyncMessage(errorMessage(error));
    }
  };

  const exportBackup = async () => {
    try {
      const text = await exportEncryptedBackup(password);
      downloadTextFile(text, `healthier-backup-${localDateKey()}.hdbak`);
      setMessage("加密备份已下载。请妥善保管密码，应用无法找回。 ");
    } catch (error) { setMessage(errorMessage(error)); }
  };

  const inspectBackup = async () => {
    try {
      const payload = await decryptBackup(backupText, password);
      setPreview(payload);
      setMessage("校验成功。确认后将整体替换本机数据。 ");
    } catch (error) { setPreview(undefined); setMessage(errorMessage(error)); }
  };

  const restore = async () => {
    if (!preview || !confirm("确定整体替换本机全部 Healthier 数据？此操作不可合并。")) return;
    try {
      await restoreBackup(preview, password);
      location.reload();
    } catch (error) { setMessage(errorMessage(error)); }
  };

  const undoRestore = async () => {
    if (!rollbackBackup || !confirm("撤销上次恢复，并换回恢复前的数据？")) return;
    try {
      const payload = await decryptBackup(rollbackBackup, password);
      await restoreBackup(payload, password);
      location.reload();
    } catch (error) { setMessage(errorMessage(error)); }
  };

  return (
    <div className="page-stack">
      <PageIntro eyebrow="设置与数据" title="资料、身体指标和数据接力" description="本机仍是主数据；可通过加密同步包在手机和电脑之间接力，并定期保留独立备份。" />
      <ProfileEditor />
      <form className="card" onSubmit={async (event) => { event.preventDefault(); const measuredAt = `${metric.date}T12:00:00`; const bodyMetric: BodyMetric = { id: crypto.randomUUID(), measuredAt, weightKg: metric.weightKg, waistCm: metric.waistCm || undefined, note: metric.note || undefined }; await db.bodyMetrics.put(bodyMetric); setMessage("身体指标已记录。 "); }}>
        <div className="section-heading"><div><span className="eyebrow">趋势事实</span><h2>记录体重和腰围</h2></div></div>
        <div className="form-grid two-columns"><label>日期<input type="date" value={metric.date} onChange={(event) => setMetric({ ...metric, date: event.target.value })} /></label><label>体重（kg）<input required type="number" min="20" max="300" step="0.1" value={metric.weightKg} onChange={(event) => setMetric({ ...metric, weightKg: number(event.target.value) })} /></label><label>腰围（cm，可选）<input type="number" min="0" max="250" step="0.1" value={metric.waistCm || ""} onChange={(event) => setMetric({ ...metric, waistCm: number(event.target.value) })} /></label><label>备注<input value={metric.note} onChange={(event) => setMetric({ ...metric, note: event.target.value })} /></label></div>
        <button className="secondary full-width" type="submit">保存身体指标</button>
        {metrics.slice(0, 3).map((item) => <p className="metric-row" key={item.id}><span>{item.measuredAt.slice(0, 10)}</span><b>{item.weightKg.toFixed(1)} kg{item.waistCm ? ` · 腰围 ${item.waistCm.toFixed(1)} cm` : ""}</b><button className="text-button danger" type="button" onClick={() => void db.bodyMetrics.delete(item.id)}>删除</button></p>)}
      </form>
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">HD-SYNC-1</span><h2>跨设备接力（文件版）</h2></div><span className="step-pill">不依赖云服务</span></div>
        <p className="helper">同步包是完整加密快照，不会实时合并。换设备前导出，在另一台设备输入同一密码、预览并整体恢复。</p>
        {localSyncState?.lastSyncedAt && <p className="sync-state">本机最近接力：{new Date(localSyncState.lastSyncedAt).toLocaleString("zh-CN")}</p>}
        <label>同步包密码（至少8字符）<input type="password" minLength={8} value={syncPassword} onChange={(event) => { setSyncPassword(event.target.value); setSyncPreview(undefined); }} /></label>
        <button className="primary full-width" type="button" onClick={() => void exportSyncPackage()}>导出本机同步包</button>
        <hr />
        <label className="file-picker">选择 `.hdsync` 文件<input type="file" accept=".hdsync,application/json" onChange={async (event) => { const file = event.target.files?.[0]; setSyncText(file ? await file.text() : ""); setSyncPreview(undefined); setSyncMessage(""); }} /></label>
        <button className="secondary full-width" type="button" disabled={!syncText} onClick={() => void inspectSync()}>解密、校验并预览</button>
        {syncPreview && <div className={`backup-preview sync-preview ${syncPreview.importStatus.toLowerCase()}`}>
          <b>数据导出时间：{new Date(syncPreview.payload.exportedAt).toLocaleString("zh-CN")}</b>
          <span>餐食 {syncPreview.payload.meals.length} 条 · 食物项 {syncPreview.payload.mealItems.length} 条 · 身体指标 {syncPreview.payload.bodyMetrics.length} 条</span>
          <span>{SYNC_IMPORT_LABELS[syncPreview.importStatus]}</span>
          <button className={syncPreview.importStatus === "CONFLICT" ? "danger-button" : "secondary"} type="button" onClick={() => void restoreSync()}>确认用同步包替换本机</button>
        </div>}
        {syncMessage && <p className={`notice ${syncPreview?.importStatus === "CONFLICT" ? "warning" : ""}`}>{syncMessage.trim()}</p>}
      </section>
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">AES-256-GCM</span><h2>加密备份与恢复</h2></div></div>
        <p className="helper">密码经 PBKDF2-SHA-256 迭代 310,000 次派生。恢复前只预览数量，确认后整体替换。</p>
        <label>备份密码（至少8字符）<input type="password" minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setPreview(undefined); }} /></label>
        <button className="primary full-width" type="button" onClick={() => void exportBackup()}>下载加密备份</button>
        <hr />
        <label className="file-picker">选择 `.hdbak` 文件<input type="file" accept=".hdbak,application/json" onChange={async (event) => { const file = event.target.files?.[0]; setBackupText(file ? await file.text() : ""); setPreview(undefined); }} /></label>
        <button className="secondary full-width" type="button" disabled={!backupText} onClick={() => void inspectBackup()}>校验并预览</button>
        {preview && <div className="backup-preview"><b>备份时间：{new Date(preview.exportedAt).toLocaleString("zh-CN")}</b><span>餐食 {preview.meals.length} 条 · 食物项 {preview.mealItems.length} 条 · 身体指标 {preview.bodyMetrics.length} 条</span><button className="danger-button" type="button" onClick={() => void restore()}>确认整体替换</button></div>}
        {rollbackBackup && <button className="secondary full-width" type="button" onClick={() => void undoRestore()}>撤销上次恢复</button>}
        {message && <p className="notice">{message.trim()}</p>}
      </section>
      <section className="card quiet-card"><h2>隐私与适用范围</h2><p>本应用不上传数据、不调用 AI 接口，也不提供疾病治疗、用药或化验单建议。营养评价只用于个人日常自查。</p></section>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, children }: PropsWithChildren<{ eyebrow: string; title: string; description: string }>) {
  return <section className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p>{children}</section>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

export default function HealthierApp() {
  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/book" element={<BookKnowledgePage />} />
          <Route path="/book/:chapterId" element={<BookChapterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}
