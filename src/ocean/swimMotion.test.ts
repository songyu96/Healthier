import { describe, expect, it, vi, afterEach } from "vitest";
import { armDirections, seaHeight, SWIM_CYCLE_SECONDS } from "./swimMotion";
import { supportsOceanWebGL } from "./webglSupport";

afterEach(() => vi.restoreAllMocks());
describe("swimming motion", () => {
  it("所有划水阶段连续循环，左右臂可以镜像使用", () => {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.15) {
      const left = armDirections(phase, 1), right = armDirections(phase, -1), loop = armDirections(phase + Math.PI * 2, 1);
      for (const part of ["upper", "lower"] as const) {
        left[part].forEach((value, i) => expect(loop[part][i]).toBeCloseTo(value, 8));
        expect(right[part][0]).toBe(-left[part][0]);
        expect(Math.hypot(...left[part])).toBeGreaterThan(0.1);
      }
    }
  });
  it("低分时仍持续划水；海面浮动保持平缓", () => {
    expect(SWIM_CYCLE_SECONDS.EASY).toBeGreaterThan(SWIM_CYCLE_SECONDS.SURGE);
    expect(SWIM_CYCLE_SECONDS.EASY).toBeLessThan(4);
    for (let time = 0; time < 120; time += 0.2) {
      expect(Math.abs(seaHeight(0, 0, time))).toBeLessThanOrEqual(0.067);
    }
  });
});
describe("WebGL capability", () => {
  it("无 WebGL 或上下文创建异常时可回退", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(supportsOceanWebGL()).toBe(false);
    getContext.mockImplementation(() => { throw new Error("GPU disabled"); });
    expect(supportsOceanWebGL()).toBe(false);
  });
  it("探测成功后释放临时上下文", () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension: () => ({ loseContext }) } as unknown as WebGL2RenderingContext);
    expect(supportsOceanWebGL()).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
  });
});
