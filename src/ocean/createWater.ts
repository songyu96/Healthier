import { Float32BufferAttribute, Mesh, MeshPhysicalMaterial, PlaneGeometry, Vector2, Vector3, Vector4 } from "three";
import { SEA_HEIGHT_GLSL, type OceanQuality, type RoutePose } from "./swimMotion";
import { createWaterGrid, renderedWaterHeight } from "./waterSampling";

const WAKE_SAMPLE_COUNT = 12;

export function createWater(quality: OceanQuality) {
  const grid = createWaterGrid(quality);
  const { segments, axis, spacing } = grid;
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, axis[i % (segments + 1)], 0, axis[Math.floor(i / (segments + 1))]);
  }
  geometry.setAttribute("gridSpacing", new Float32BufferAttribute(spacing, 1));
  geometry.computeBoundingSphere();
  const wakeSamples = Array.from({ length: WAKE_SAMPLE_COUNT }, () => new Vector4(0, 0, 0, -100));
  let wakeCount = 0, lastWakeTime = Number.NEGATIVE_INFINITY;
  const uniforms = {
    oceanTime: { value: 0 }, origin: { value: new Vector2() },
    swimmer: { value: new Vector3() }, wakeStrength: { value: 0.55 }, warmth: { value: 0 },
    wakeSamples: { value: wakeSamples }, wakeSampleCount: { value: 0 }
  };
  // Use the scene's Sky PMREM and lights, with water's dielectric reflectance.
  const material = new MeshPhysicalMaterial({
    color: "#12525d", metalness: 0, roughness: 0.38, ior: 1.333,
    transmission: 0.22, thickness: 3.5, attenuationColor: "#176772", attenuationDistance: 5.5,
    transparent: true, opacity: 1, depthWrite: false
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      uniform float oceanTime;
      uniform vec2 origin;
      attribute float gridSpacing;
      varying vec3 worldPoint;
      varying float sampleSpacing;
      ${SEA_HEIGHT_GLSL}
    ` + shader.vertexShader.replace("#include <begin_vertex>", `
        vec2 p = position.xz + origin;
        sampleSpacing = gridSpacing;
        vec3 transformed = vec3(position.x, seaHeight(p, oceanTime, gridSpacing), position.z);
        worldPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = `
      uniform float oceanTime;
      uniform vec3 swimmer;
      uniform float wakeStrength;
      uniform float warmth;
      uniform vec4 wakeSamples[${WAKE_SAMPLE_COUNT}];
      uniform float wakeSampleCount;
      varying vec3 worldPoint;
      varying float sampleSpacing;
      ${SEA_HEIGHT_GLSL}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);
      }
      vec2 noiseSlope(vec2 p) {
        vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f), d=6.0*f*(1.0-f);
        float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), e=hash(i+vec2(1.0));
        return d*(vec2(b-a,c-a)+(a-b-c+e)*u.yx);
      }
    ` + shader.fragmentShader.replace("#include <normal_fragment_maps>", `
        #include <normal_fragment_maps>
        vec2 p = worldPoint.xz;
        vec4 wave = seaSample(p, oceanTime, sampleSpacing);
        // Include the derivative of the spatial LOD fade, not only the retained wave slopes.
        vec2 px = dFdx(p), py = dFdy(p);
        float determinant = px.x*py.y-px.y*py.x;
        vec2 spacingSlope = abs(determinant)>0.00000001
          ? vec2(dFdx(sampleSpacing)*py.y-dFdy(sampleSpacing)*px.y, px.x*dFdy(sampleSpacing)-py.x*dFdx(sampleSpacing))/determinant
          : vec2(0.0);
        wave.yz += wave.w*spacingSlope;
        float distanceToEye = length(cameraPosition - worldPoint);
        float detail = 1.0 - smoothstep(12.0, 80.0, distanceToEye);
        // All scales travel with one wind field. Fade detail smaller than a pixel.
        vec2 windPoint = p - vec2(0.12, 0.055)*oceanTime;
        mat2 rotation=mat2(0.8,-0.6,0.6,0.8);
        float footprint=length(fwidth(p));
        vec2 ripple = noiseSlope(windPoint*3.2)*0.06*(1.0-smoothstep(0.25,0.75,footprint*3.2));
        ripple += transpose(rotation)*noiseSlope(rotation*windPoint*7.1)*0.02*(1.0-smoothstep(0.25,0.75,footprint*7.1));
        ripple += noiseSlope(windPoint*15.4)*0.006*(1.0-smoothstep(0.25,0.75,footprint*15.4));
        vec3 n = normalize(vec3(-wave.y-ripple.x*detail,1.0,-wave.z-ripple.y*detail));
        normal = normalize(mat3(viewMatrix)*n);
        nonPerturbedNormal = normalize(mat3(viewMatrix)*normalize(vec3(-wave.y,1.0,-wave.z)));
    `).replace("#include <color_fragment>", `
        #include <color_fragment>
        vec2 wakePoint = worldPoint.xz;
        float turbulence = noise((wakePoint-vec2(0.12,0.055)*oceanTime)*9.0);
        float wake = 0.0;
        for (int i=0;i<${WAKE_SAMPLE_COUNT};i++) {
          if (float(i)>=wakeSampleCount) break;
          vec4 samplePoint = wakeSamples[i];
          float age = max(0.0,oceanTime-samplePoint.w);
          vec2 forward = vec2(sin(samplePoint.z),cos(samplePoint.z));
          vec2 relative = wakePoint-samplePoint.xy;
          float along = dot(relative,forward);
          float across = dot(relative,vec2(forward.y,-forward.x));
          float width = 0.12+age*0.11;
          float length = 0.28+age*0.18;
          wake += exp(-across*across/(width*width)-along*along/(length*length))*exp(-age*0.62);
        }
        float foam = clamp(wake*smoothstep(0.42,0.82,turbulence)*wakeStrength*0.34,0.0,0.42);
        diffuseColor.rgb += vec3(0.004,0.015,0.01)*warmth;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.7,0.85,0.82),foam);
    `);
  };
  material.customProgramCacheKey = () => "ocean-physical-v2";
  const mesh = new Mesh(geometry, material);
  mesh.name = "OceanSurface";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return {
    mesh,
    heightAt(x: number, z: number, time: number) {
      const origin = uniforms.origin.value;
      return renderedWaterHeight(grid, x - origin.x, z - origin.y, origin.x, origin.y, time);
    },
    update(time: number, pose: RoutePose, energetic: boolean, luminous: boolean) {
      if (time < lastWakeTime) { wakeCount = 0; lastWakeTime = Number.NEGATIVE_INFINITY; }
      if (time - lastWakeTime >= 0.2) {
        const limit = Math.min(wakeCount, WAKE_SAMPLE_COUNT - 1);
        for (let i = limit; i > 0; i--) wakeSamples[i].copy(wakeSamples[i - 1]);
        wakeSamples[0].set(pose.x, pose.z, pose.heading, time);
        wakeCount = Math.min(wakeCount + 1, WAKE_SAMPLE_COUNT);
        lastWakeTime = time;
        uniforms.wakeSampleCount.value = wakeCount;
      }
      uniforms.oceanTime.value = time;
      uniforms.origin.value.set(pose.x,pose.z);
      uniforms.swimmer.value.set(pose.x,pose.z,pose.heading);
      uniforms.wakeStrength.value = energetic ? 1 : 0.65;
      uniforms.warmth.value = luminous ? 1 : 0;
      mesh.position.set(pose.x,0,pose.z);
    }
  };
}
