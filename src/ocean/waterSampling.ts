import { seaHeight, type OceanQuality } from "./swimMotion";

export interface WaterGrid { segments: number; axis: Float64Array; spacing: Float32Array }

export function createWaterGrid(quality: OceanQuality): WaterGrid {
  const segments = quality === "LOW" ? 128 : 224;
  const axis = Float64Array.from({ length: segments + 1 }, (_, i) => {
    const v = i / segments * 2 - 1;
    const outside = Math.max(0, Math.abs(v) - 0.5);
    // Uniform sampling in the central 16 m; C2-continuous stretching outside it.
    return Math.sign(v) * (16 * Math.abs(v) + 4672 * outside ** 3);
  });
  const steps = axis.map((value, i) => Math.max(i > 0 ? value - axis[i - 1] : 0, i < segments ? axis[i + 1] - value : 0));
  const spacing = new Float32Array((segments + 1) ** 2);
  for (let z = 0; z <= segments; z++) for (let x = 0; x <= segments; x++) {
    // Conservative bound on a triangle's diagonal, including its coarser neighbour.
    spacing[z * (segments + 1) + x] = Math.SQRT2 * Math.max(steps[x], steps[z]);
  }
  return { segments, axis, spacing };
}

function cellAt(axis: Float64Array, point: number): number {
  if (point < axis[0] || point > axis[axis.length - 1]) throw new RangeError("Water query outside the rendered grid");
  let low = 0, high = axis.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (axis[middle] <= point) low = middle; else high = middle;
  }
  return low;
}

/** Barycentric height on the same displaced triangles drawn by PlaneGeometry. */
export function renderedWaterHeight(grid: WaterGrid, localX: number, localZ: number, originX: number, originZ: number, time: number): number {
  const { axis, spacing, segments } = grid;
  const x = cellAt(axis, localX), z = cellAt(axis, localZ);
  const u = (localX - axis[x]) / (axis[x + 1] - axis[x]);
  const v = (localZ - axis[z]) / (axis[z + 1] - axis[z]);
  const height = (dx: number, dz: number) => seaHeight(originX + axis[x + dx], originZ + axis[z + dz], time, spacing[(z + dz) * (segments + 1) + x + dx]);
  return u + v <= 1
    ? height(0, 0) * (1 - u - v) + height(1, 0) * u + height(0, 1) * v
    : height(1, 1) * (u + v - 1) + height(1, 0) * (1 - v) + height(0, 1) * (1 - u);
}
