// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HealthierApp from "./HealthierApp";
import {
  clearMealDraft,
  db,
  isStoredMealDraft,
  loadMealDraft,
  MEAL_DRAFT_SETTING_KEY,
  saveConfirmedMeal,
  saveMealDraft
} from "./db";
import type { ConfirmedMeal, ParsedMeal, UserProfile } from "./domain";

vi.mock("virtual:pwa-register", () => ({ registerSW: () => vi.fn() }));
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    clearMealDraft: vi.fn(original.clearMealDraft),
    loadMealDraft: vi.fn(original.loadMealDraft)
  };
});

const profile: UserProfile = {
  id: "default",
  birthDate: "1990-01-01",
  dietPattern: "OMNIVORE",
  dailyExercise: "NONE",
  dietHabitSummary: "三餐规律",
  heightCm: 175,
  currentWeightKg: 70,
  activityLevel: "LIGHT",
  overweightAdjustmentEnabled: false,
  healthFlags: [],
  updatedAt: "2026-09-11T08:00:00.000Z"
};

function localDate(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sampleDraft(date = localDate()): ParsedMeal {
  return {
    protocolVersion: "HD1",
    eatenAt: `${date}T12:00:00`,
    date,
    mealType: "L",
    items: [{
      tempId: "draft-rice",
      name: "米饭",
      category: "GR",
      state: "CK",
      quantityMin: 100,
      quantityMax: 100,
      unit: "g",
      canonicalFoodId: "rice-cooked"
    }],
    cookingMethod: "",
    note: "未保存",
    rawImportLine: "",
    unknownOil: true,
    unknownSalt: true
  };
}

function sampleMeal(date = localDate()): ConfirmedMeal {
  return {
    ...sampleDraft(date),
    id: "saved-meal",
    ruleSetVersion: "book-rules-0.1",
    createdAt: `${date}T12:01:00`,
    updatedAt: `${date}T12:01:00`
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button"))
    .find((button) => button.textContent?.trim() === text);
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function waitFor(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    }
  }
  throw lastError;
}

describe("meal draft lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.mocked(clearMealDraft).mockImplementation(async () => {
      await db.settings.delete(MEAL_DRAFT_SETTING_KEY);
    });
    vi.mocked(loadMealDraft).mockImplementation(async () => {
      const stored = await db.settings.get(MEAL_DRAFT_SETTING_KEY);
      return isStoredMealDraft(stored?.value) ? stored.value : undefined;
    });
    await db.profiles.put(profile);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    });
  });

  async function renderApp(path = "/"): Promise<void> {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={[path]}><HealthierApp /></MemoryRouter>);
    });
    const readyText = path === "/history" ? "查看任意日期餐食" : "把这一餐逐项加进来";
    await waitFor(() => expect(container.textContent).toContain(readyText));
  }

  it("HD1解析失败不会删除已恢复的新建草稿", async () => {
    const draft = sampleDraft();
    await saveMealDraft(draft);
    await renderApp();

    const input = container.querySelector<HTMLTextAreaElement>(".hd1-input");
    expect(input).toBeTruthy();
    await act(async () => {
      if (input) setInputValue(input, "不是HD1数据");
    });
    await act(async () => buttonByText(container, "解析并人工确认")?.click());

    await expect(loadMealDraft()).resolves.toEqual(draft);
    expect(container.textContent).toContain("确认食物与重量");
  });

  it("初始化读取完成前不开放草稿操作", async () => {
    const pending = deferred<ParsedMeal | undefined>();
    vi.mocked(loadMealDraft).mockReturnValueOnce(pending.promise);

    await act(async () => {
      root.render(<MemoryRouter><HealthierApp /></MemoryRouter>);
    });

    expect(container.textContent).toContain("正在恢复未保存的餐食");
    expect(buttonByText(container, "取消本餐")).toBeUndefined();

    await act(async () => pending.resolve(sampleDraft()));
    await waitFor(() => expect(buttonByText(container, "取消本餐")).toBeDefined());
  });

  it.each(["取消", "取消本餐"])("编辑已有餐食会清除新建草稿且通过“%s”取消后不会恢复", async (cancelLabel) => {
    await saveMealDraft(sampleDraft());
    await saveConfirmedMeal(sampleMeal());
    await renderApp();
    await waitFor(() => expect(buttonByText(container, "编辑")).toBeDefined());

    await act(async () => buttonByText(container, "编辑")?.click());
    await waitFor(() => expect(container.textContent).toContain("正在编辑已有餐食"));
    await expect(loadMealDraft()).resolves.toBeUndefined();

    await act(async () => buttonByText(container, cancelLabel)?.click());
    await waitFor(() => expect(container.querySelector("#meal-draft-editor")).toBeNull());
    await expect(loadMealDraft()).resolves.toBeUndefined();
  });

  it("周总结编辑已有餐食前清除新建草稿", async () => {
    await saveMealDraft(sampleDraft());
    await saveConfirmedMeal(sampleMeal());
    await renderApp("/history");
    await waitFor(() => expect(buttonByText(container, "编辑")).toBeDefined());

    await act(async () => buttonByText(container, "编辑")?.click());
    await waitFor(() => expect(container.querySelector("#meal-draft-editor")).not.toBeNull());

    await expect(loadMealDraft()).resolves.toBeUndefined();
  });

  it("周总结清除新建草稿失败时不进入编辑并显示错误", async () => {
    const draft = sampleDraft();
    await saveMealDraft(draft);
    await saveConfirmedMeal(sampleMeal());
    vi.mocked(clearMealDraft).mockRejectedValueOnce(new Error("草稿清除失败"));
    await renderApp("/history");
    await waitFor(() => expect(buttonByText(container, "编辑")).toBeDefined());

    await act(async () => buttonByText(container, "编辑")?.click());
    await waitFor(() => expect(container.textContent).toContain("草稿清除失败"));

    expect(container.querySelector("#meal-draft-editor")).toBeNull();
    await expect(loadMealDraft()).resolves.toEqual(draft);
  });

  it("跨日后刷新今日日期但不改动已恢复草稿的补录时间", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T23:59:30"));
    const draft = sampleDraft("2026-09-14");
    await saveMealDraft(draft);
    await renderApp();
    const editorTime = container.querySelector<HTMLInputElement>("#meal-draft-editor input[type='datetime-local']");
    expect(editorTime?.value).toBe("2026-09-14T12:00");

    vi.setSystemTime(new Date("2026-09-16T00:01:00"));
    await act(async () => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(container.textContent).toContain("2026-09-16"));
    expect(editorTime?.value).toBe("2026-09-14T12:00");
    await expect(loadMealDraft()).resolves.toEqual(draft);
  });

  it("跨日刷新不会覆盖用户手动填写的补录时间", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T23:59:30"));
    await renderApp();
    const quickTime = container.querySelector<HTMLInputElement>(".quick-meal-card input[type='datetime-local']");
    expect(quickTime).toBeTruthy();
    await act(async () => {
      if (quickTime) setInputValue(quickTime, "2026-09-10T18:30");
    });

    vi.setSystemTime(new Date("2026-09-16T00:01:00"));
    await act(async () => window.dispatchEvent(new Event("focus")));

    expect(quickTime?.value).toBe("2026-09-10T18:30");
  });

  it("长时间打开后新建餐食采用点击加入时的当前时间", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T08:00:00"));
    await renderApp();
    const search = container.querySelector<HTMLInputElement>("input[placeholder='例如：鸡蛋、牛奶、米饭']");
    expect(search).toBeTruthy();

    vi.setSystemTime(new Date("2026-09-15T12:34:00"));
    await act(async () => {
      if (search) setInputValue(search, "鸡蛋");
    });
    await waitFor(() => expect(buttonByText(container, "加入本餐")).toBeDefined());
    await act(async () => buttonByText(container, "加入本餐")?.click());
    await waitFor(() => expect(container.querySelector("#meal-draft-editor")).not.toBeNull());

    const editorTime = container.querySelector<HTMLInputElement>("#meal-draft-editor input[type='datetime-local']");
    expect(editorTime?.value).toBe("2026-09-15T12:34");
  });
});
