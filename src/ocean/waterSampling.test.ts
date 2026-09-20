import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createOceanWaves, OCEAN_WAVES, seaHeight, seaSample, waveRetention, type OceanQuality } from "./swimMotion";
import { createWaterGrid } from "./waterSampling";
import { createWater } from "./createWater";

describe("distributed ocean waves", () => {
  it("相同种子可重建同一波面，波长和方向有分布且不增加总体浪高", () => {
    expect(createOceanWaves(42)).toEqual(createOceanWaves(42));
    expect(createOceanWaves(43)).not.toEqual(createOceanWaves(42));
    const lengths = OCEAN_WAVES.map((wave) => wave.wavelength);
    const angles = OCEAN_WAVES.map((wave) => Math.atan2(wave.z, wave.x));
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeGreaterThan(8);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(1.5);
    expect(Math.sqrt(OCEAN_WAVES.reduce((sum, wave) => sum + wave.amplitude ** 2 / 2, 0))).toBeCloseTo(0.1, 10);
  });

  it("短波在达到混叠范围之前退出，过滤过程连续且单调", () => {
    for (const wave of OCEAN_WAVES) {
      expect(waveRetention(wave.wavelength, wave.wavelength / 8).weight).toBe(1);
      expect(waveRetention(wave.wavelength, wave.wavelength / 4).weight).toBe(0);
      let previous = 1;
      for (let i = 0; i <= 100; i++) {
        const result = waveRetention(wave.wavelength, wave.wavelength * i / 300);
        expect(result.weight).toBeLessThanOrEqual(previous);
        expect(result.weight).toBeGreaterThanOrEqual(0);
        previous = result.weight;
      }
      expect(waveRetention(wave.wavelength, wave.wavelength / 8).derivative).toBeCloseTo(0, 12);
      expect(waveRetention(wave.wavelength, wave.wavelength / 4).derivative).toBeCloseTo(0, 12);
    }
  });

  it("法线包含采样过渡的导数，与实际高度的差分一致", () => {
    const x = 12.3, z = -8.2, time = 31, spacing = 1.4, epsilon = 0.0001;
    const sample = seaSample(x, z, time, spacing);
    const dx = 0.13, dz = -0.08;
    const field = (px: number, pz: number) => seaHeight(px, pz, time, spacing + (px-x)*dx + (pz-z)*dz);
    expect(sample.slopeX + sample.spacingDerivative*dx).toBeCloseTo((field(x+epsilon,z)-field(x-epsilon,z))/(2*epsilon), 6);
    expect(sample.slopeZ + sample.spacingDerivative*dz).toBeCloseTo((field(x,z+epsilon)-field(x,z-epsilon))/(2*epsilon), 6);
  });
});

describe.each<OceanQuality>(["LOW", "BALANCED"])("%s water sampling", (quality) => {
  it("人物附近保留全部几何波，外圈不再绘制采样不足的短波", () => {
    const grid = createWaterGrid(quality);
    const center = grid.segments / 2;
    expect(grid.axis[center]).toBe(0);
    let largestNearSpacing = 0;
    for (let z = 0; z <= grid.segments; z++) for (let x = 0; x <= grid.segments; x++) {
      if (Math.abs(grid.axis[x]) > 7 || Math.abs(grid.axis[z]) > 7) continue;
      const spacing = grid.spacing[z * (grid.segments + 1) + x];
      largestNearSpacing = Math.max(largestNearSpacing, spacing);
    }
    for (const wave of OCEAN_WAVES) expect(waveRetention(wave.wavelength, largestNearSpacing).weight).toBe(1);
    for (const wave of OCEAN_WAVES) expect(waveRetention(wave.wavelength, grid.spacing[0]).weight).toBe(0);
  });

  it("浮动物体查询的高度等于当前画质和位置下的实际水面三角形", () => {
    const water = createWater(quality);
    const geometry = water.mesh.geometry.clone();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    try {
      const origin = { x: -53.27, z: 48.73, heading: 0.4 }, time = 17.3;
      water.update(time, origin, false, false);
      const positions = geometry.getAttribute("position"), spacing = geometry.getAttribute("gridSpacing");
      for (let i = 0; i < positions.count; i++) {
        positions.setY(i, seaHeight(positions.getX(i)+origin.x, positions.getZ(i)+origin.z, time, spacing.getX(i)));
      }
      geometry.computeBoundingSphere();
      mesh.position.copy(water.mesh.position);
      mesh.updateMatrixWorld(true);
      for (const [x,z] of [[0,0],[0.37,-0.56],[6.13,2.71],[12.3,-16.8],[31.2,47.7],[101.3,-206.4]]) {
        const queryX = x+origin.x, queryZ = z+origin.z;
        const ray = new Raycaster(new Vector3(queryX, 10, queryZ), new Vector3(0,-1,0));
        const hits = ray.intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        expect(water.heightAt(queryX,queryZ,time)).toBeCloseTo(hits[0].point.y, 5);
      }
    } finally {
      geometry.dispose(); material.dispose(); water.mesh.geometry.dispose(); water.mesh.material.dispose();
    }
  });
});
