import { describe, expect, it, vi, afterEach } from "vitest";
import { advanceSwim, armDirections, seaHeight, SWIM_CYCLE_SECONDS, MAX_SEA_HEIGHT, routePose, ROUTE_RADIUS, transportView, type SwimClock } from "./swimMotion";
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
      expect(Math.abs(seaHeight(0, 0, time))).toBeLessThanOrEqual(MAX_SEA_HEIGHT);
    }
  });
});
describe("visual travel", () => {
  it("持续前进，节奏改变不重置位置；暂停和后台恢复不会跳跃", () => {
    let clock: SwimClock = { time: 0, phase: 0, distance: 0 };
    for (let i = 0; i < 600; i++) clock = advanceSwim(clock, 1/60, "EASY", false);
    expect(clock.distance).toBeCloseTo(5.5, 8);
    expect(routePose(clock.distance).z).toBeGreaterThan(5);
    expect(advanceSwim(clock, 60, "SURGE", true)).toEqual(clock);
    const faster = advanceSwim(clock, 1/60, "SURGE", false);
    expect(faster.distance).toBeGreaterThan(clock.distance);
    expect(advanceSwim(clock, 60, "SURGE", false).distance-clock.distance).toBeLessThan(0.06);
  });
  it("环形航线连续闭合，并与可见岛屿保持间距", () => {
    const loop = ROUTE_RADIUS*Math.PI*2;
    expect(routePose(loop).x).toBeCloseTo(0);
    expect(routePose(loop).z).toBeCloseTo(0);
    for (let distance = 0; distance < loop; distance++) {
      const p = routePose(distance);
      for (const [x,z,radius] of [[-24,38,13],[30,77,21],[-70,130,30]]) {
        expect(Math.hypot(p.x-x,p.z-z)).toBeGreaterThan(radius+2);
      }
    }
  });
  it("跟随镜头保留拖动角度和缩放，暂停时不改变镜头位置", () => {
    const from = routePose(7), to = routePose(50);
    const point: [number,number,number] = [from.x+3,2,from.z-4];
    const moved = transportView(point,from,to);
    expect(Math.hypot(moved[0]-to.x,moved[2]-to.z)).toBeCloseTo(5);
    expect(moved[1]).toBe(2);
    const restored = transportView(moved,to,from);
    restored.forEach((value,i) => expect(value).toBeCloseTo(point[i]));
    expect(transportView(point,from,from)).toEqual(point);
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
