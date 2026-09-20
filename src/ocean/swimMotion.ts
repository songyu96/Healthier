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

export function armDirections(phase: number, side: -1 | 1): { upper: [number, number, number]; lower: [number, number, number] } {
  const recovery = Math.max(0, -Math.sin(phase));
  const bend = 0.2 + recovery * 1.1;
  return {
    upper: [side * (0.18 + recovery * 0.48), Math.cos(phase), Math.sin(phase) * 0.9],
    lower: [side * 0.12, Math.cos(phase - bend), Math.sin(phase - bend)]
  };
}
