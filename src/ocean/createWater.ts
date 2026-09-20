import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from "three";
import { SEA_HEIGHT_GLSL, type OceanQuality, type RoutePose } from "./swimMotion";

export function createWater(quality: OceanQuality) {
  const segments = quality === "LOW" ? 128 : 224;
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const spread = (v: number) => Math.sign(v) * (Math.abs(v) * 10 + Math.pow(Math.abs(v), 3) * 590);
    positions.setXYZ(i, spread(positions.getX(i)), 0, spread(positions.getZ(i)));
  }
  geometry.computeBoundingSphere();
  const uniforms = {
    oceanTime: { value: 0 }, origin: { value: new Vector2() },
    swimmer: { value: new Vector3() }, wakeStrength: { value: 0.55 }, warmth: { value: 0 }
  };
  const material = new ShaderMaterial({
    uniforms, transparent: true, opacity: 0.94, depthWrite: false,
    vertexShader: `
      uniform float oceanTime;
      uniform vec2 origin;
      varying vec3 worldPoint;
      ${SEA_HEIGHT_GLSL}
      void main() {
        vec2 p = position.xz + origin;
        vec3 displaced = vec3(position.x, seaHeight(p, oceanTime), position.z);
        worldPoint = (modelMatrix * vec4(displaced, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float oceanTime;
      uniform vec3 swimmer;
      uniform float wakeStrength;
      uniform float warmth;
      varying vec3 worldPoint;
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
      void main() {
        vec2 p = worldPoint.xz;
        vec3 wave = seaSample(p, oceanTime);
        float distanceToEye = length(cameraPosition - worldPoint);
        float detail = 1.0 - smoothstep(12.0, 80.0, distanceToEye);
        // Advected noise gradients break up long regular wave bands. Fade subpixel detail.
        mat2 rotation=mat2(0.8,-0.6,0.6,0.8);
        float footprint=length(fwidth(p));
        vec2 ripple = noiseSlope(p*3.2+vec2(oceanTime*0.4,oceanTime*0.18))*0.2*(1.0-smoothstep(0.25,0.75,footprint*3.2));
        ripple += transpose(rotation)*noiseSlope(rotation*p*7.1+vec2(-oceanTime*0.28,oceanTime*0.34))*0.085*(1.0-smoothstep(0.25,0.75,footprint*7.1));
        ripple += noiseSlope(p*15.4+vec2(oceanTime*0.3,-oceanTime*0.2))*0.035*(1.0-smoothstep(0.25,0.75,footprint*15.4));
        wave.yz *= mix(0.15,1.0,1.0-smoothstep(35.0,170.0,distanceToEye));
        vec3 n = normalize(vec3(-wave.y-ripple.x*detail,1.0,-wave.z-ripple.y*detail));
        vec3 eye = normalize(cameraPosition-worldPoint);
        float fresnel = 0.025 + 0.975*pow(1.0-max(dot(n,eye),0.0),5.0);
        vec3 reflected = reflect(-eye,n);
        vec3 sky = mix(vec3(0.52,0.66,0.72),vec3(0.12,0.34,0.56),smoothstep(0.0,0.7,reflected.y));
        float swell = smoothstep(-0.25,0.28,wave.x);
        vec3 water = mix(vec3(0.006,0.055,0.083),vec3(0.018,0.23,0.25),swell*0.65+0.2);
        water += vec3(0.004,0.025,0.015)*warmth;
        vec3 color = mix(water,sky,fresnel);
        vec3 sun = normalize(vec3(-30.0,45.0,-55.0));
        vec3 halfDirection = normalize(eye+sun);
        float glint = pow(max(dot(n,halfDirection),0.0),220.0);
        color += vec3(1.0,0.88,0.66)*glint*1.8;
        color += vec3(0.07,0.19,0.17)*pow(max(dot(eye,-sun),0.0),3.0)*swell*(1.0-fresnel);
        vec2 forward = vec2(sin(swimmer.z),cos(swimmer.z));
        vec2 relative = p-swimmer.xy;
        float behind = -dot(relative,forward)-0.3;
        float across = dot(relative,vec2(forward.y,-forward.x));
        float turbulence = noise(p*9.0+vec2(oceanTime*0.25,-oceanTime*0.3));
        float wakeWidth = 0.16+max(behind,0.0)*0.18;
        float wake = exp(-pow((abs(across)-wakeWidth)/(0.07+max(behind,0.0)*0.05),2.0));
        wake *= smoothstep(0.0,0.4,behind)*(1.0-smoothstep(1.3,5.5,behind));
        float bubbles = exp(-across*across/0.09)*smoothstep(0.0,0.2,behind)*(1.0-smoothstep(0.4,2.7,behind));
        float foam = clamp((wake*0.35+bubbles*0.4)*smoothstep(0.45,0.9,turbulence)*wakeStrength,0.0,0.5);
        color = mix(color,vec3(0.7,0.85,0.82),foam);
        color = mix(color,vec3(0.36,0.51,0.57),1.0-exp(-distanceToEye*0.003));
        gl_FragColor = vec4(color,0.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "OceanSurface";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return {
    mesh,
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
