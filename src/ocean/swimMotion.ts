import type { SwimPace } from "../gamePresentation";

export type OceanView = "FOLLOW" | "OVERHEAD" | "COAST";
export type OceanQuality = "BALANCED" | "LOW";
export const SWIM_CYCLE_SECONDS: Record<SwimPace, number> = { EASY: 3.2, STEADY: 2.5, SURGE: 1.9 };
// Visual travel is independent of saved game mileage.
export const SWIM_SPEED: Record<SwimPace, number> = { EASY: 0.55, STEADY: 0.8, SURGE: 1.1 };
export const ROUTE_RADIUS = 100;
export interface SwimClock { time: number; phase: number; distance: number }
export interface RoutePose { x: number; z: number; heading: number }
export function advanceSwim(clock: SwimClock, delta: number, pace: SwimPace, paused: boolean): SwimClock {
  if (paused) return clock;
  const step = Math.max(0, Math.min(delta, 0.05));
  return { time: clock.time + step, phase: clock.phase + step / SWIM_CYCLE_SECONDS[pace] * Math.PI * 2, distance: clock.distance + step * SWIM_SPEED[pace] };
}
export function routePose(distance: number): RoutePose {
  const angle = distance / ROUTE_RADIUS;
  return { x: ROUTE_RADIUS * (Math.cos(angle) - 1), z: ROUTE_RADIUS * Math.sin(angle), heading: -angle };
}
// Transport an orbit view with the swimmer, preserving the user's orbit and zoom.
export function transportView(point: [number, number, number], from: RoutePose, to: RoutePose): [number, number, number] {
  const angle = to.heading - from.heading, c = Math.cos(angle), s = Math.sin(angle);
  const x = point[0] - from.x, z = point[2] - from.z;
  return [to.x + x * c + z * s, point[1], to.z - x * s + z * c];
}
export const CAMERA_VIEWS: Record<OceanView, { position: [number, number, number]; target: [number, number, number] }> = {
  FOLLOW: { position: [2.6, 1.0, -3.7], target: [0, 0.1, 0.45] },
  OVERHEAD: { position: [0.6, 5.4, -0.7], target: [0, 0, 0] },
  COAST: { position: [4.2, 2.4, -6.3], target: [-1.5, 0.3, 4] }
};

const WAVES = [
  { x: 0.36, z: 0.25, amplitude: 0.16, phase: 0.4 },
  { x: -0.57, z: 0.73, amplitude: 0.085, phase: 1.8 },
  { x: 1.16, z: 0.44, amplitude: 0.045, phase: 3.1 },
  { x: -1.8, z: -1.12, amplitude: 0.024, phase: 2.4 },
  { x: 2.7, z: -1.9, amplitude: 0.012, phase: 5.2 }
].map((wave) => ({ ...wave, speed: Math.sqrt(9.81 * Math.hypot(wave.x, wave.z)) }));
export const MAX_SEA_HEIGHT = WAVES.reduce((sum, wave) => sum + wave.amplitude * 1.16, 0);
export function seaHeight(x: number, z: number, time: number): number {
  return WAVES.reduce((height, wave) => {
    const phase = x * wave.x + z * wave.z - time * wave.speed + wave.phase;
    return height + wave.amplitude * (Math.sin(phase) + 0.16 * Math.sin(phase * 2));
  }, 0);
}

// Generate GPU heights and analytic slopes from the same waves used for buoyancy.
const glsl = (value: number) => value.toFixed(8);
export const SEA_HEIGHT_GLSL = `
vec3 seaSample(vec2 p, float t) {
  vec3 result = vec3(0.0);
  ${WAVES.map((wave) => `{
    vec2 k = vec2(${glsl(wave.x)}, ${glsl(wave.z)});
    float a = dot(p, k) - t * ${glsl(wave.speed)} + ${glsl(wave.phase)};
    result.x += ${glsl(wave.amplitude)} * (sin(a) + 0.16 * sin(2.0*a));
    result.yz += k * ${glsl(wave.amplitude)} * (cos(a) + 0.32 * cos(2.0*a));
  }`).join("\n")}
  return result;
}
float seaHeight(vec2 p, float t) { return seaSample(p, t).x; }
`;

export function armDirections(phase: number, side: -1 | 1): { upper: [number, number, number]; lower: [number, number, number] } {
  const recovery = Math.max(0, -Math.sin(phase));
  const bend = 0.2 + recovery * 1.1;
  return {
    upper: [side * (0.18 + recovery * 0.48), Math.cos(phase), Math.sin(phase) * 0.9],
    lower: [side * 0.12, Math.cos(phase - bend), Math.sin(phase - bend)]
  };
}
