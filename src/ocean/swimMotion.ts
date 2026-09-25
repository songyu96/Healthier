import type { SwimPace } from "../gamePresentation";

export type OceanView = "FOLLOW" | "OVERHEAD" | "COAST";
export type OceanQuality = "BALANCED" | "LOW";
export const SWIM_CYCLE_SECONDS: Record<SwimPace, number> = { EASY: 2.2, STEADY: 1.8, SURGE: 1.5 };
// Visual travel is independent of saved game mileage.
export const SWIM_SPEED: Record<SwimPace, number> = { EASY: 0.75, STEADY: 1.0, SURGE: 1.3 };
export const ROUTE_RADIUS = 100;
// Surface drift also advects the water shader's fine ripples (metres/second).
export const SURFACE_CURRENT = { x: 0.12, z: 0.055 };
export interface SwimClock { time: number; phase: number; distance: number }
export interface RoutePose { x: number; z: number; heading: number }
// One breath every three individual arm strokes, alternating sides. Hold the
// inhalation briefly and return the face before the recovering hand enters.
export function breathingPose(phase: number): number {
  const cycles = phase / (Math.PI * 2);
  const event = Math.floor((cycles - 0.55) / 1.5);
  if (event < 0) return 0;
  const t = cycles - event * 1.5;
  if (t >= 0.96) return 0;
  const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x*x*(3-2*x); };
  return (event % 2 === 0 ? 1 : -1) * smooth((t - 0.55) / 0.15) * (1 - smooth((t - 0.82) / 0.14));
}
export interface SwimEnvironment { forwardSlope: number; forwardFlow: number; crossFlow: number; verticalVelocity: number }
export function sampleSwimEnvironment(pose: RoutePose, time: number): SwimEnvironment {
  let flowX = SURFACE_CURRENT.x, flowZ = SURFACE_CURRENT.z, verticalVelocity = 0;
  for (const wave of OCEAN_WAVES) {
    const phase = pose.x * wave.x + pose.z * wave.z - time * wave.speed + wave.phase;
    const orbitalSpeed = wave.amplitude * wave.speed;
    const k = Math.hypot(wave.x, wave.z);
    flowX += orbitalSpeed * Math.sin(phase) * wave.x / k;
    flowZ += orbitalSpeed * Math.sin(phase) * wave.z / k;
    verticalVelocity -= orbitalSpeed * Math.cos(phase);
  }
  const surface = seaSample(pose.x, pose.z, time);
  const s = Math.sin(pose.heading), c = Math.cos(pose.heading);
  return { forwardSlope: surface.slopeX * s + surface.slopeZ * c, forwardFlow: flowX * s + flowZ * c, crossFlow: flowX * c - flowZ * s, verticalVelocity };
}
export function swimLoad(environment: SwimEnvironment): number {
  return Math.max(-0.35, Math.min(0.55, environment.forwardSlope * 2 - environment.forwardFlow * 0.8 + Math.abs(environment.crossFlow) * 0.25));
}
export function advanceSwim(clock: SwimClock, delta: number, pace: SwimPace, paused: boolean, environment?: SwimEnvironment): SwimClock {
  if (paused) return clock;
  const step = Math.max(0, Math.min(delta, 0.05));
  const water = environment ?? sampleSwimEnvironment(routePose(clock.distance), clock.time);
  const load = swimLoad(water);
  const variation = 0.035 * Math.sin(clock.time * 0.47) + 0.02 * Math.sin(clock.time * 0.81 + 1.1);
  const cadence = 1 + load * 0.24 + variation;
  const speed = SWIM_SPEED[pace] * (1 - load * 0.18) + Math.max(-0.22, Math.min(0.22, water.forwardFlow)) * 0.28;
  return { time: clock.time + step, phase: clock.phase + step / SWIM_CYCLE_SECONDS[pace] * Math.PI * 2 * cadence, distance: clock.distance + step * Math.max(0.25, speed) };
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

export interface OceanWave { x: number; z: number; amplitude: number; phase: number; speed: number; wavelength: number }
export function createOceanWaves(seed: number): readonly OceanWave[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  // Stratified log wavelengths and two directional lobes avoid a few dominant parallel bands.
  const waves = Array.from({ length: 18 }, (_, i) => {
    const wavelength = 3.2 * Math.pow(36 / 3.2, (i + 0.1 + random() * 0.8) / 18);
    const direction = i % 4 === 0 ? 2.4 + (random() - 0.5) : 0.65 + (random() - 0.5) * 1.3;
    const k = Math.PI * 2 / wavelength;
    const amplitude = Math.exp(-0.5 * Math.pow(Math.log(wavelength / 9) / 0.9, 2)) * (0.65 + random() * 0.5);
    return { x: Math.cos(direction) * k, z: Math.sin(direction) * k, amplitude, wavelength, phase: random() * Math.PI * 2, speed: Math.sqrt(9.81 * k) };
  });
  // Keep a modest RMS height rather than increasing wave energy as components are added.
  const scale = 0.1 / Math.sqrt(waves.reduce((sum, wave) => sum + wave.amplitude ** 2 / 2, 0));
  return waves.map((wave) => ({ ...wave, amplitude: wave.amplitude * scale }));
}
export const OCEAN_WAVES = createOceanWaves(0x534541);
export const MAX_SEA_HEIGHT = OCEAN_WAVES.reduce((sum, wave) => sum + wave.amplitude, 0);

// Full strength at >= 8 samples per wavelength; zero at <= 4, before Nyquist aliasing.
export function waveRetention(wavelength: number, gridSpacing: number): { weight: number; derivative: number } {
  const width = wavelength / 8;
  const blend = Math.max(0, Math.min(1, (gridSpacing - width) / width));
  return { weight: 1 - blend * blend * (3 - 2 * blend), derivative: -6 * blend * (1 - blend) / width };
}
export function seaSample(x: number, z: number, time: number, gridSpacing = 0) {
  let height = 0, slopeX = 0, slopeZ = 0, spacingDerivative = 0;
  for (const wave of OCEAN_WAVES) {
    const { weight, derivative } = waveRetention(wave.wavelength, gridSpacing);
    const phase = x * wave.x + z * wave.z - time * wave.speed + wave.phase;
    const value = wave.amplitude * Math.sin(phase);
    const slope = wave.amplitude * Math.cos(phase) * weight;
    height += value * weight;
    slopeX += wave.x * slope;
    slopeZ += wave.z * slope;
    spacingDerivative += value * derivative;
  }
  return { height, slopeX, slopeZ, spacingDerivative };
}
export function seaHeight(x: number, z: number, time: number, gridSpacing = 0): number {
  return seaSample(x, z, time, gridSpacing).height;
}

// Generate GPU heights and analytic slopes from the same waves used for buoyancy.
const glsl = (value: number) => value.toFixed(8);
export const SEA_HEIGHT_GLSL = `
vec4 seaSample(vec2 p, float t, float spacing) {
  vec4 result = vec4(0.0);
  ${OCEAN_WAVES.map((wave) => `{
    vec2 k = vec2(${glsl(wave.x)}, ${glsl(wave.z)});
    float a = dot(p, k) - t * ${glsl(wave.speed)} + ${glsl(wave.phase)};
    float width = ${glsl(wave.wavelength / 8)};
    float blend = clamp((spacing-width)/width, 0.0, 1.0);
    float weight = 1.0-blend*blend*(3.0-2.0*blend);
    float value = ${glsl(wave.amplitude)} * sin(a);
    result.x += value * weight;
    result.yz += k * ${glsl(wave.amplitude)} * cos(a) * weight;
    result.w += value * (-6.0*blend*(1.0-blend)/width);
  }`).join("\n")}
  return result;
}
float seaHeight(vec2 p, float t, float spacing) { return seaSample(p, t, spacing).x; }
`;

type Direction = [number, number, number];
// Body coordinates: +Y toward the head, +Z into the water in the prone pose.
// Entry, extension, catch, pull, push, exit and bent-elbow recovery.
const STROKE_KEYS: { at: number; upper: Direction; lower: Direction }[] = [
  { at: 0, upper: [0.18, 0.98, 0.02], lower: [-0.04, 0.99, 0.06] },
  { at: 0.15, upper: [0.12, 0.98, 0.13], lower: [-0.06, 0.94, 0.30] },
  { at: 0.32, upper: [0.44, 0.70, 0.55], lower: [-0.22, 0.08, 0.97] },
  { at: 0.48, upper: [0.58, -0.24, 0.72], lower: [-0.22, -0.82, 0.52] },
  { at: 0.62, upper: [0.20, -0.97, 0.10], lower: [-0.07, -0.99, 0.04] },
  { at: 0.74, upper: [0.56, -0.62, -0.56], lower: [-0.28, 0.18, 0.94] },
  { at: 0.87, upper: [0.64, 0.33, -0.69], lower: [-0.36, 0.84, 0.40] }
];
export function armDirections(phase: number, side: -1 | 1, load = 0): { upper: Direction; lower: Direction } {
  const t = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  const count = STROKE_KEYS.length;
  const i = STROKE_KEYS.findIndex((key, index) => t >= key.at && (index === count - 1 || t < STROKE_KEYS[index + 1].at));
  const a = STROKE_KEYS[i], b = STROKE_KEYS[(i + 1) % count];
  const previous = STROKE_KEYS[(i + count - 1) % count], next = STROKE_KEYS[(i + 2) % count];
  const end = i === count - 1 ? 1 : b.at;
  const previousTime = i === 0 ? previous.at - 1 : previous.at;
  const nextTime = i >= count - 2 ? next.at + 1 : next.at;
  const duration = end - a.at, u = (t - a.at) / duration;
  const interpolate = (part: "upper" | "lower"): Direction => {
    const result = a[part].map((value, axis) => {
      const tangentA = (b[part][axis] - previous[part][axis]) / (end - previousTime);
      const tangentB = (next[part][axis] - value) / (nextTime - a.at);
      return (2*u**3-3*u*u+1)*value + (u**3-2*u*u+u)*duration*tangentA
        + (-2*u**3+3*u*u)*b[part][axis] + (u**3-u*u)*duration*tangentB;
    }) as Direction;
    result[0] *= side;
    result[2] += Math.max(-0.35, Math.min(0.55, load)) * 0.12 * Math.sin(t * Math.PI * 2) ** 2;
    const length = Math.hypot(...result);
    return result.map(value => value / length) as Direction;
  };
  return { upper: interpolate("upper"), lower: interpolate("lower") };
}
