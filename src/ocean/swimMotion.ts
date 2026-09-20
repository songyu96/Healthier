import type { SwimPace } from "../gamePresentation";

export type OceanView = "FOLLOW" | "OVERHEAD" | "COAST";
export type OceanQuality = "BALANCED" | "LOW";
export const SWIM_CYCLE_SECONDS: Record<SwimPace, number> = { EASY: 3.2, STEADY: 2.5, SURGE: 1.9 };
export const CAMERA_VIEWS: Record<OceanView, { position: [number, number, number]; target: [number, number, number] }> = {
  FOLLOW: { position: [2.6, 1.0, -3.7], target: [0, 0.1, 0.45] },
  OVERHEAD: { position: [0.6, 5.4, -0.7], target: [0, 0, 0] },
  COAST: { position: [4.2, 2.4, -6.3], target: [-1.5, 0.3, 4] }
};

export function seaHeight(x: number, z: number, time: number): number {
  return Math.sin(x * 0.72 + z * 0.48 - time * 0.85) * 0.045
    + Math.sin(x * -1.3 + z * 0.85 - time * 1.25) * 0.022;
}

// Same wave function is used by the water shader and the swimmer's buoyancy.
export const SEA_HEIGHT_GLSL = `
float seaHeight(vec2 p, float t) {
  return sin(p.x * 0.72 + p.y * 0.48 - t * 0.85) * 0.045
       + sin(p.x * -1.3 + p.y * 0.85 - t * 1.25) * 0.022;
}`;

export function armDirections(phase: number, side: -1 | 1): { upper: [number, number, number]; lower: [number, number, number] } {
  const recovery = Math.max(0, -Math.sin(phase));
  const bend = 0.2 + recovery * 1.1;
  return {
    upper: [side * (0.18 + recovery * 0.48), Math.cos(phase), Math.sin(phase) * 0.9],
    lower: [side * 0.12, Math.cos(phase - bend), Math.sin(phase - bend)]
  };
}
