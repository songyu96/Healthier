export const ISLANDS = [
  { x: -24, z: 38, radius: 13, height: 6.5, seed: 1 },
  { x: 30, z: 77, radius: 21, height: 12, seed: 3 },
  { x: -70, z: 130, radius: 30, height: 16, seed: 4 }
] as const;
export const SEABED_HEIGHT = -18;
export function terrainNoise(x: number, z: number): number {
  return Math.sin(x * 1.7 + Math.sin(z * 0.83)) * 0.5 + Math.sin(z * 2.13 - x * 0.37) * 0.25 + Math.sin(x * 4.17 + z * 3.16) * 0.125;
}
export function islandHeight(x: number, z: number, radius: number, height: number, seed: number): number {
  const edge = 1 - Math.hypot(x, z * Math.sqrt(1.3)) / radius + terrainNoise(x * 0.24 + seed, z * 0.23) * 0.13;
  const shelf = Math.max(0, Math.min(1, (0.15 - edge) / 0.45));
  return Math.max(SEABED_HEIGHT, Math.max(0, edge) ** 1.6 * height + terrainNoise(x * 0.42 + seed, z * 0.45) * Math.max(0, edge) * 1.9 - 0.28 - 18 * shelf * shelf * (3 - 2 * shelf));
}
export function seabedHeight(x: number, z: number): number {
  return Math.max(SEABED_HEIGHT, ...ISLANDS.map(island => islandHeight(x-island.x, z-island.z, island.radius, island.height, island.seed)));
}
// The water tint samples the same analytic terrain used to build the island meshes.
export const COAST_DEPTH_GLSL = `
float terrainNoise(vec2 p) {
  return sin(p.x*1.7+sin(p.y*0.83))*0.5+sin(p.y*2.13-p.x*0.37)*0.25+sin(p.x*4.17+p.y*3.16)*0.125;
}
float islandGround(vec2 p,float radius,float height,float seed) {
  float edge=1.0-length(p*vec2(1.0,sqrt(1.3)))/radius+terrainNoise(p*vec2(0.24,0.23)+vec2(seed,0.0))*0.13;
  float shelf=clamp((0.15-edge)/0.45,0.0,1.0);
  return max(-18.0,pow(max(0.0,edge),1.6)*height+terrainNoise(p*vec2(0.42,0.45)+vec2(seed,0.0))*max(0.0,edge)*1.9-0.28-18.0*shelf*shelf*(3.0-2.0*shelf));
}
float oceanGround(vec2 p) {
  float ground=-18.0;
  ${ISLANDS.map(i => `ground=max(ground,islandGround(p-vec2(${i.x.toFixed(1)},${i.z.toFixed(1)}),${i.radius.toFixed(1)},${i.height.toFixed(1)},${i.seed.toFixed(1)}));`).join("\n")}
  return ground;
}`;
