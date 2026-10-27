import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { NavLink } from "react-router-dom";
import {
  applyCurrentSafetyAdmission,
  assessDay,
  calculateTargets,
  nutritionFactsForMeal,
  resolveDailyTargets,
  type DailyAssessment
} from "./domain";
import { mergeFoodRegistry } from "./domain/nutrition/foodRegistry";
import { useApp } from "./context/AppContext";
import {
  addGameGoal,
  archiveGameGoal,
  db,
  deleteGameCheckin,
  loadGameState,
  loadMealsBetween,
  recordGameProgress,
  setGameCheckin,
  startGame,
  updateGameGoal,
  type AppSetting
} from "./db";
import {
  calculateGameSnapshot,
  dateKey,
  datesBetween,
  GAME_UNLOCKS,
  gameWeightDescription,
  goalVersionOn,
  JOURNEY_DESTINATIONS,
  nextWeekStart,
  shiftDate,
  type DietMode,
  type GameGoalCategory,
  type GameGoalVersion
} from "./game";
import JourneyMap from "./JourneyMap";

const CATEGORY_LABELS: Record<GameGoalCategory, string> = {
  FITNESS: "健身",
  SPORT: "球类或运动",
  READING: "阅读",
  ART: "艺术练习",
  OTHER: "其他"
};

const EMPTY_FORM: Omit<GameGoalVersion, "effectiveOn"> = {
  name: "",
  category: "FITNESS",
  weeklyFrequency: 3,
  minimumMinutes: 30
};

function settingValue(settings: AppSetting[], key: string): unknown {
  return settings.find((setting) => setting.key === key)?.value;
}

function completedFromSettings(settings: AppSetting[], date: string): boolean {
  const completion = settingValue(settings, `dayComplete:${date}`);
  if (typeof completion === "boolean") return completion;
  if (!completion || typeof completion !== "object") return false;
  const revision = settingValue(settings, `dayRevision:${date}`);
  const value = completion as { completed?: unknown; revision?: unknown };
  return value.completed === true && value.revision === (typeof revision === "number" ? revision : 0);
}

export default function GamePage() {
  const { profile } = useApp();
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingGoalId, setEditingGoalId] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useLiveQuery(loadGameState, [], undefined);
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const overrides = useLiveQuery(() => db.foodOverrides.toArray(), [], []);
  const meals = useLiveQuery(
    () => state && state.startedOn <= today ? loadMealsBetween(state.startedOn, today) : Promise.resolve([]),
    [state?.startedOn, today],
    []
  );
  const foods = useMemo(() => mergeFoodRegistry(overrides), [overrides]);
  const currentTargets = useMemo(() => profile ? calculateTargets(profile) : undefined, [profile]);
  const dietMode: DietMode = !currentTargets ? "NO_PROFILE" : currentTargets.safetyRestricted ? "SAFETY_PAUSED" : "AVAILABLE";

  useEffect(() => {
    const update = () => setToday(dateKey(new Date()));
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  const assessments = useMemo<Record<string, DailyAssessment>>(() => {
    if (!state || !currentTargets) return {};
    const result: Record<string, DailyAssessment> = {};
    const settingsByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
    const mealsByDate = new Map<string, typeof meals>();
    meals.forEach((meal) => mealsByDate.set(meal.date, [...(mealsByDate.get(meal.date) ?? []), meal]));
    datesBetween(state.startedOn, today).forEach((date) => {
      const dateMeals = mealsByDate.get(date) ?? [];
      const targets = applyCurrentSafetyAdmission(
        resolveDailyTargets(dateMeals, settingsByKey.get(`dayTarget:${date}`), currentTargets),
        currentTargets
      );
      result[date] = assessDay(
        date,
        dateMeals.map((meal) => ({ meal, facts: nutritionFactsForMeal(meal, foods) })),
        targets,
        { completed: completedFromSettings(settings, date), waterMl: Number(settingsByKey.get(`water:${date}`) ?? 0) }
      );
    });
    return result;
  }, [currentTargets, foods, meals, settings, state, today]);
  const snapshot = useMemo(
    () => state && state.startedOn <= today ? calculateGameSnapshot(state, today, assessments, dietMode) : undefined,
    [assessments, dietMode, state, today]
  );
  const pendingUnlockKey = snapshot?.newUnlocks.join(",") ?? "";
  const voyagePoints = snapshot?.voyagePoints;
  useEffect(() => {
    if (voyagePoints === undefined) return;
    if (state?.voyagePoints !== undefined && voyagePoints <= state.voyagePoints && !pendingUnlockKey) return;
    void recordGameProgress(voyagePoints, snapshot?.newUnlocks ?? [])
      .catch((error: unknown) => setMessage(error instanceof Error
        ? `航程保存失败，当前最高航程尚未持久化：${error.message}`
        : "航程保存失败，当前最高航程尚未持久化，请保持页面开启后重试。"));
  }, [pendingUnlockKey, snapshot?.newUnlocks, state?.voyagePoints, voyagePoints]);

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请重试。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const version = { ...form, name: form.name.trim() };
    void run(
      () => editingGoalId ? updateGameGoal(editingGoalId, version, today) : addGameGoal(version, today),
      editingGoalId ? `目标修改将于 ${nextWeekStart(today)} 生效。` : "目标已加入海洋旅程。"
    ).then((saved) => { if (saved) { setEditingGoalId(undefined); setForm(EMPTY_FORM); } });
  };

  if (!state) return <div className="page-stack">
    <section className="page-intro"><span className="eyebrow">幻想群岛</span><h1>让每一天推动一小段航程</h1>
      <p>记录饮食、练习自己的目标，探索三个海域与十三处目的地。旅程从开启当天算起，不追溯以前的记录。</p>
    </section>
    <section className="card game-start-card"><JourneyMap voyagePoints={0} recalculatedPoints={0} week={{ points: 0, dietPoints: 0, dietStatus: "尚未开始", goalEarnedSessions: 0, goalPlannedSessions: 0 }} />
      <button className="primary" type="button" disabled={busy} onClick={() => void run(() => startGame(today), "幻想群岛旅程已开启。")}>开启群岛旅程</button>
    </section>
  </div>;

  if (state.startedOn > today) return <div className="page-stack">
    <section className="page-intro"><span className="eyebrow">海洋旅程</span><h1>等待旅程开始</h1>
      <p>这台设备的今天是 {today}，早于旅程开始日 {state.startedOn}。请检查设备日期；到开始日后旅程会自动显示。</p>
    </section>
  </div>;

  const activeGoals = state.goals.filter((goal) => goalVersionOn(goal, today));
  const selectedGoals = state.goals.filter((goal) => goalVersionOn(goal, selectedDate));
  const currentWeek = snapshot?.currentWeek;
  const dietStatus = dietMode === "SAFETY_PAUSED" ? "安全限制，暂不评价" :
    dietMode === "NO_PROFILE" ? "填写资料后评价" :
      (currentWeek?.dietPoints ?? 0) > 0 ? `已获得 ${currentWeek?.dietPoints.toFixed(1)} 分` : "本周尚未获得加成";
  const goalProgress = (currentWeek?.goalPlannedSessions ?? 0) > 0
    ? `${currentWeek?.goalEarnedSessions.toFixed(1) ?? "0.0"} / ${currentWeek?.goalPlannedSessions} 次`
    : "未设置";

  return <div className="page-stack">
    <section className="page-intro"><span className="eyebrow">幻想群岛 · {state.startedOn} 启航</span><h1>今天驶向哪里？</h1>
      <p>{gameWeightDescription(dietMode, Boolean(currentWeek?.goalPlannedSessions))} 少记录或休息不会让历史最高航程倒退。</p>
    </section>
    <section className="card game-scene-card">
      <JourneyMap
        voyagePoints={snapshot?.voyagePoints ?? state.voyagePoints ?? 0}
        recalculatedPoints={snapshot?.mileage ?? 0}
        week={{
          points: currentWeek?.points ?? 0,
          dietPoints: currentWeek?.dietPoints ?? 0,
          dietStatus,
          goalEarnedSessions: currentWeek?.goalEarnedSessions ?? 0,
          goalPlannedSessions: currentWeek?.goalPlannedSessions ?? 0
        }}
      />
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">本周航海任务</span><h2>三股前进动力</h2></div></div>
      <div className="journey-missions">
        <div><span aria-hidden="true">🥗</span><small>准备航海补给</small><strong>{dietStatus}</strong></div>
        <div><span aria-hidden="true">🧭</span><small>练习进度（按时长折算）</small><strong>{goalProgress}</strong></div>
        <div><span aria-hidden="true">⛵</span><small>驶向下一站</small><strong>{currentWeek?.points.toFixed(1) ?? "0.0"} / 100 分</strong></div>
      </div>
      {dietMode === "SAFETY_PAUSED" && currentTargets?.safetyMessages.map((item) => <p className="notice warning" key={item}>{item}</p>)}
      {dietMode === "NO_PROFILE" && <p className="helper">填写个人资料后才可评价饮食；自设目标仍能推动旅程。 <NavLink to="/calculator">填写资料</NavLink></p>}
      <p className="helper">饮食分母固定为 7 天；只采用可比较的蔬菜、鲜果与食物多样性记录。游戏加成不代表整体健康判断。</p>
    </section>
    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">旅行图鉴</span><h2>发现的地点与伙伴</h2></div><small>{JOURNEY_DESTINATIONS.filter((destination) => (snapshot?.voyagePoints ?? 0) >= destination.threshold).length} / {JOURNEY_DESTINATIONS.length} 地点</small></div>
      <div className="journey-atlas-grid">{JOURNEY_DESTINATIONS.map((destination) => {
        const discovered = (snapshot?.voyagePoints ?? 0) >= destination.threshold;
        return <div className={discovered ? "discovered" : ""} key={destination.id}><span aria-hidden="true">{destination.type === "REST" ? "🏝️" : destination.type === "FINALE" ? "🌟" : "◈"}</span><b>{destination.name}</b><small>{discovered ? "已发现" : `${destination.threshold} 分`}</small></div>;
      })}</div>
      <h3 className="journey-reward-title">永久纪念</h3>
      <div className="game-unlock-grid">{GAME_UNLOCKS.map((unlock) => <div className={snapshot?.unlocks.includes(unlock.id) ? "game-unlock unlocked" : "game-unlock"} key={unlock.id}>
        <span aria-hidden="true">{unlock.id === "DOLPHIN" ? "🐬" : unlock.id === "BUTTERFLY" ? "🗼" : "🌅"}</span>
        <b>{unlock.label}</b><small>{snapshot?.unlocks.includes(unlock.id) ? "已解锁" : `${unlock.threshold} 分解锁`}</small>
        <p className="helper">{unlock.description}</p>
      </div>)}</div>
    </section>
    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">我的目标</span><h2>每周练习计划</h2></div></div>
      {activeGoals.length === 0 && <p className="helper">还没有进行中的目标；也可先由饮食记录推动旅程。</p>}
      <div className="game-goal-list">{activeGoals.map((goal) => {
        const version = goalVersionOn(goal, today)!;
        const pending = goal.versions.find((item) => item.effectiveOn > today);
        const stoppingTomorrow = goal.archivedOn === shiftDate(today, 1);
        return <article key={goal.id}><div><b>{version.name}</b><span>{CATEGORY_LABELS[version.category]} · 每周 {version.weeklyFrequency} 次 · 每次 {version.minimumMinutes} 分钟</span>
          {pending && <small>{pending.effectiveOn} 起：每周 {pending.weeklyFrequency} 次，每次 {pending.minimumMinutes} 分钟</small>}</div>
          {stoppingTomorrow && <small>明日起停用，今天的打卡仍有效。</small>}
          <div className="game-goal-actions"><button className="secondary" type="button" disabled={busy || stoppingTomorrow} onClick={() => { setEditingGoalId(goal.id); setForm({ name: version.name, category: version.category, weeklyFrequency: version.weeklyFrequency, minimumMinutes: version.minimumMinutes }); }}>修改</button>
            <button className="secondary" type="button" disabled={busy || stoppingTomorrow} onClick={() => void run(() => archiveGameGoal(goal.id, today), "目标明日起停用，今天的打卡仍有效。")}>{stoppingTomorrow ? "明日停用" : "停用"}</button></div>
        </article>;
      })}</div>
      <form className="game-goal-form" onSubmit={saveGoal}>
        <h3>{editingGoalId ? `修改目标（${nextWeekStart(today)} 生效）` : "新增目标"}</h3>
        <label>目标名称<input required maxLength={50} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：游泳、读书、练琴" /></label>
        <div className="game-form-grid"><label>类别<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as GameGoalCategory })}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label><label>每周次数<input type="number" required min="1" max="7" step="1" value={form.weeklyFrequency} onChange={(event) => setForm({ ...form, weeklyFrequency: Number(event.target.value) })} /></label>
          <label>每次最低分钟<input type="number" required min="1" max="1440" step="1" value={form.minimumMinutes} onChange={(event) => setForm({ ...form, minimumMinutes: Number(event.target.value) })} /></label></div>
        <div className="game-goal-actions"><button className="primary" type="submit" disabled={busy}>{editingGoalId ? "保存下周计划" : "加入目标"}</button>
          {editingGoalId && <button className="secondary" type="button" onClick={() => { setEditingGoalId(undefined); setForm(EMPTY_FORM); }}>取消修改</button>}</div>
      </form>
    </section>
    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">练习打卡</span><h2>按日期记录时长</h2></div></div>
      <label>选择日期<input type="date" min={state.startedOn} max={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
      {selectedGoals.length === 0 && <p className="helper">这一天没有生效中的目标。</p>}
      <div className="game-checkin-list">{selectedGoals.map((goal) => {
        const version = goalVersionOn(goal, selectedDate)!;
        const existing = state.checkins.find((item) => item.goalId === goal.id && item.date === selectedDate);
        return <form key={`${goal.id}:${selectedDate}`} onSubmit={(event) => {
          event.preventDefault();
          const minutes = Number(new FormData(event.currentTarget).get("minutes"));
          void run(() => setGameCheckin({ goalId: goal.id, date: selectedDate, minutes }, today), "打卡已保存，旅程已重算。");
        }}><div><b>{version.name}</b><small>最低 {version.minimumMinutes} 分钟 · {existing ? `已记 ${existing.minutes} 分钟` : "未打卡"}</small></div>
          <input name="minutes" aria-label={`${version.name}实际分钟`} type="number" required min="1" max="1440" step="1" defaultValue={existing?.minutes ?? ""} />
          <button className="primary" type="submit" disabled={busy}>保存</button>
          {existing && <button className="secondary" type="button" disabled={busy} onClick={() => void run(() => deleteGameCheckin(goal.id, selectedDate), "打卡已删除，旅程已重算。")}>删除</button>}
        </form>;
      })}</div>
      {selectedDate < today && <p className="helper">补录或删除历史打卡会重算该周及之后的旅程积分。</p>}
    </section>
  </div>;
}
