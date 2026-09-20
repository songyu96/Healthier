import { Float32BufferAttribute, Mesh, MeshPhysicalMaterial, PlaneGeometry, Vector2, Vector3 } from "three";
import { SEA_HEIGHT_GLSL, type OceanQuality, type RoutePose } from "./swimMotion";
import { createWaterGrid, renderedWaterHeight } from "./waterSampling";

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
  const uniforms = {
    oceanTime: { value: 0 }, origin: { value: new Vector2() },
    swimmer: { value: new Vector3() }, wakeStrength: { value: 0.55 }, warmth: { value: 0 }
  };
  // Use the scene's Sky PMREM and lights, with water's dielectric reflectance.
  const material = new MeshPhysicalMaterial({
    color: "#12525d", metalness: 0, roughness: 0.3, ior: 1.333,
    transparent: true, opacity: 0.93, depthWrite: false
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
        vec2 ripple = noiseSlope(windPoint*3.2)*0.09*(1.0-smoothstep(0.25,0.75,footprint*3.2));
        ripple += transpose(rotation)*noiseSlope(rotation*windPoint*7.1)*0.035*(1.0-smoothstep(0.25,0.75,footprint*7.1));
        ripple += noiseSlope(windPoint*15.4)*0.012*(1.0-smoothstep(0.25,0.75,footprint*15.4));
        vec3 n = normalize(vec3(-wave.y-ripple.x*detail,1.0,-wave.z-ripple.y*detail));
        normal = normalize(mat3(viewMatrix)*n);
        nonPerturbedNormal = normalize(mat3(viewMatrix)*normalize(vec3(-wave.y,1.0,-wave.z)));
    `).replace("#include <color_fragment>", `
        #include <color_fragment>
        vec2 wakePoint = worldPoint.xz;
        vec2 forward = vec2(sin(swimmer.z),cos(swimmer.z));
        vec2 relative = wakePoint-swimmer.xy;
        float behind = -dot(relative,forward)-0.3;
        float across = dot(relative,vec2(forward.y,-forward.x));
        float turbulence = noise((wakePoint-vec2(0.12,0.055)*oceanTime)*9.0);
        float wakeWidth = 0.16+max(behind,0.0)*0.18;
        float wake = exp(-pow((abs(across)-wakeWidth)/(0.07+max(behind,0.0)*0.05),2.0));
        wake *= smoothstep(0.0,0.4,behind)*(1.0-smoothstep(1.3,5.5,behind));
        float bubbles = exp(-across*across/0.09)*smoothstep(0.0,0.2,behind)*(1.0-smoothstep(0.4,2.7,behind));
        float foam = clamp((wake*0.35+bubbles*0.4)*smoothstep(0.45,0.9,turbulence)*wakeStrength,0.0,0.5);
        diffuseColor.rgb += vec3(0.004,0.015,0.01)*warmth;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.7,0.85,0.82),foam);
    `);
  };
  material.customProgramCacheKey = () => "ocean-physical-v1";
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
      uniforms.oceanTime.value = time;
      uniforms.origin.value.set(pose.x,pose.z);
      uniforms.swimmer.value.set(pose.x,pose.z,pose.heading);
      uniforms.wakeStrength.value = energetic ? 1 : 0.65;
      uniforms.warmth.value = luminous ? 1 : 0;
      mesh.position.set(pose.x,0,pose.z);
    }
  };
}
