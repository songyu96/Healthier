import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import GamePage from "./GamePage";
import { AppProvider } from "./context/AppContext";
import { db, startGame } from "./db";

afterEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
});

describe("ocean game page", () => {
  it("导入未来开始日期时显示等待提示，不访问不存在的当前周", async () => {
    await startGame("2099-01-01");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(<MemoryRouter><AppProvider><GamePage /></AppProvider></MemoryRouter>);
      });
      await vi.waitFor(() => expect(container.textContent).toContain("等待旅程开始"));
      expect(container.textContent).toContain("2099-01-01");
      expect(container.textContent).not.toContain("当前可核算里程");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
