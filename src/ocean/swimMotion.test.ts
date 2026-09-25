import { describe, expect, it, vi, afterEach } from "vitest";
import { advanceSwim, armDirections, breathingPose, seaHeight, sampleSwimEnvironment, SWIM_CYCLE_SECONDS, MAX_SEA_HEIGHT, routePose, ROUTE_RADIUS, transportView, type SwimClock, type SwimEnvironment } from "./swimMotion";
import { supportsOceanWebGL } from "./webglSupport";

afterEach(() => vi.restoreAllMocks());
describe("swimming motion", () => {
  it("常规划频提高，每三次单臂划水换气，入水前收头", () => {
    expect(120 / SWIM_CYCLE_SECONDS.STEADY).toBeGreaterThanOrEqual(60);
    for (let event = 0; event < 8; event++) {
      const start = event * 1.5;
      expect(breathingPose((start + 0.76) * Math.PI * 2)).toBe(event % 2 === 0 ? 1 : -1);
      expect(breathingPose((start + 0.99) * Math.PI * 2)).toBe(0);
      for (const t of [0.55,0.70,0.82,0.96]) {
        const before = breathingPose((start+t-0.00001)*Math.PI*2);
        const after = breathingPose((start+t+0.00001)*Math.PI*2);
        expect(Math.abs(after-before)).toBeLessThan(0.00001);
      }
    }
  });
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
  it("伸展、抱水、高肘回臂各有姿态，所有交界处位置和速度连续", () => {
    const reach = armDirections(0.15 * Math.PI * 2, 1);
    const catchPose = armDirections(0.32 * Math.PI * 2, 1);
    const recovery = armDirections(0.87 * Math.PI * 2, 1);
    expect(reach.upper[1]).toBeGreaterThan(0.9);
    expect(catchPose.lower[2]).toBeGreaterThan(0.9);
    expect(recovery.upper[2]).toBeLessThan(-0.5);
    expect(recovery.lower[1]).toBeGreaterThan(0.7);
    const epsilon = 0.00001;
    for (const key of [0, 0.15, 0.32, 0.48, 0.62, 0.74, 0.87, 1]) {
      const phase = key * Math.PI * 2;
      const before = armDirections(phase - epsilon, 1), at = armDirections(phase, 1), after = armDirections(phase + epsilon, 1);
      for (const part of ["upper", "lower"] as const) for (let axis = 0; axis < 3; axis++) {
        expect(Math.abs(after[part][axis] - before[part][axis])).toBeLessThan(0.0001);
        expect(Math.abs((after[part][axis] - at[part][axis]) / epsilon - (at[part][axis] - before[part][axis]) / epsilon)).toBeLessThan(0.002);
      }
    }
  });
});
describe("visual travel", () => {
  it("持续前进，节奏改变不重置位置；暂停和后台恢复不会跳跃", () => {
    let clock: SwimClock = { time: 0, phase: 0, distance: 0 };
    for (let i = 0; i < 600; i++) clock = advanceSwim(clock, 1/60, "EASY", false);
    expect(clock.distance).toBeGreaterThan(6.5);
    expect(clock.distance).toBeLessThan(8.5);
    expect(routePose(clock.distance).z).toBeGreaterThan(6.5);
    expect(advanceSwim(clock, 60, "SURGE", true)).toEqual(clock);
    const faster = advanceSwim(clock, 1/60, "SURGE", false);
    expect(faster.distance).toBeGreaterThan(clock.distance);
    expect(advanceSwim(clock, 60, "SURGE", false).distance-clock.distance).toBeLessThan(0.08);
  });
  it("逆流加划频、降航速；顺流放松划频、提高航速，节奏变化不倒退", () => {
    const clock = { time: 8, phase: 3, distance: 5 };
    const against: SwimEnvironment = { forwardSlope: 0.12, forwardFlow: -0.2, crossFlow: 0.1, verticalVelocity: 0.1 };
    const withFlow = { ...against, forwardSlope: -0.12, forwardFlow: 0.2 };
    const hard = advanceSwim(clock, 1/60, "STEADY", false, against);
    const easy = advanceSwim(clock, 1/60, "STEADY", false, withFlow);
    expect(hard.phase).toBeGreaterThan(easy.phase);
    expect(hard.distance).toBeLessThan(easy.distance);
    expect(hard.phase).toBeGreaterThan(clock.phase);
    expect(hard.distance).toBeGreaterThan(clock.distance);
    expect(advanceSwim(clock, 30, "SURGE", true, against)).toEqual(clock);
  });
  it("相同节奏的不同时间有自然划频变化；海浪的垂直速度来自同一波面", () => {
    const still = { forwardSlope: 0, forwardFlow: 0, crossFlow: 0, verticalVelocity: 0 };
    const speeds = [0, 3, 7, 12].map(time => advanceSwim({time,phase:0,distance:0}, 0.02, "STEADY", false, still).phase);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(0.001);
    const pose = routePose(14), time = 7.2, epsilon = 0.00001;
    expect(sampleSwimEnvironment(pose,time).verticalVelocity).toBeCloseTo((seaHeight(pose.x,pose.z,time+epsilon)-seaHeight(pose.x,pose.z,time-epsilon))/(2*epsilon), 6);
    expect(sampleSwimEnvironment(pose,time)).not.toEqual(sampleSwimEnvironment(pose,time+1));
  });
  it("30/60 帧下的环境响应接近，避免划频依赖设备帧率", () => {
    const simulate = (fps: number) => {
      let clock = {time:0,phase:0,distance:0};
      for (let i=0;i<fps*12;i++) clock=advanceSwim(clock,1/fps,"STEADY",false);
      return clock;
    };
    const low = simulate(30), high = simulate(60);
    expect(Math.abs(low.distance-high.distance)).toBeLessThan(0.01);
    expect(Math.abs(low.phase-high.phase)).toBeLessThan(0.015);
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
