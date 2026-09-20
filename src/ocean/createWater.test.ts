import { ShaderLib, UniformsUtils, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";
import { createWater } from "./createWater";
import type { OceanQuality } from "./swimMotion";

describe.each<OceanQuality>(["LOW", "BALANCED"])("%s physical water", (quality) => {
  it("编译及重新编译后仍读取最新动画参数，独立场景不会串用状态", () => {
    const water = createWater(quality), other = createWater(quality);
    // Exercise Three's compilation hook without a WebGL context; GPU compilation is checked in the browser.
    const compile = (instance: ReturnType<typeof createWater>) => {
      const shader = {
        vertexShader: ShaderLib.physical.vertexShader,
        fragmentShader: ShaderLib.physical.fragmentShader,
        uniforms: UniformsUtils.clone(ShaderLib.physical.uniforms)
      } as WebGLProgramParametersWithUniforms;
      instance.mesh.material.onBeforeCompile(shader, {} as WebGLRenderer);
      return shader.uniforms;
    };
    try {
      const first = compile(water), independent = compile(other);
      water.update(12, { x: 3, z: 7, heading: 0.4 }, true, true);
      const recompiled = compile(water);
      water.update(24, { x: 8, z: 9, heading: 0.8 }, false, false);
      for (const uniforms of [first, recompiled]) {
        expect(uniforms.oceanTime.value).toBe(24);
        expect(uniforms.origin.value.toArray()).toEqual([8, 9]);
        expect(uniforms.swimmer.value.toArray()).toEqual([8, 9, 0.8]);
        expect(uniforms.wakeStrength.value).toBe(0.65);
        expect(uniforms.warmth.value).toBe(0);
      }
      expect(independent.oceanTime.value).toBe(0);
      expect(independent.origin.value.toArray()).toEqual([0, 0]);
    } finally {
      for (const instance of [water, other]) {
        instance.mesh.geometry.dispose();
        instance.mesh.material.dispose();
      }
    }
  });
});
