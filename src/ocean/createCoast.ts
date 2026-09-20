import { BufferGeometry, Color, DataTexture, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, RepeatWrapping, RGBAFormat, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector2, Vector3 } from "three";
import { SEA_HEIGHT_GLSL, seaHeight, type OceanQuality } from "./swimMotion";

function noise(x: number, z: number): number {
  return Math.sin(x * 1.7 + Math.sin(z * 0.83)) * 0.5 + Math.sin(z * 2.13 - x * 0.37) * 0.25 + Math.sin(x * 4.17 + z * 3.16) * 0.125;
}

function waterNormals() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    let dx = 0, dy = 0;
    for (let wave = 1; wave <= 9; wave++) {
      const nx = wave * 2 + 1, ny = wave % 2 ? wave + 2 : -wave - 1;
      const ripple = Math.cos(u * nx + v * ny + wave * 1.17) / (wave * 9);
      dx += ripple * nx; dy += ripple * ny;
    }
    const normal = new Vector3(-dx * 0.22, -dy * 0.22, 1).normalize();
    const at = (y * size + x) * 4;
    data[at] = (normal.x * 0.5 + 0.5) * 255;
    data[at + 1] = (normal.y * 0.5 + 0.5) * 255;
    data[at + 2] = (normal.z * 0.5 + 0.5) * 255;
    data[at + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(700, 700);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function island(x: number, z: number, radius: number, height: number, seed: number) {
  const geometry = new PlaneGeometry(radius * 2.7, radius * 2.7, 72, 72);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const sand = new Color("#c8bb95"), stone = new Color("#70776c"), green = new Color("#435d39");
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), pz = positions.getZ(i);
    const distance = Math.sqrt(px * px + pz * pz * 1.3) / radius;
    const edge = 1 - distance + noise(px * 0.24 + seed, pz * 0.23) * 0.13;
    const y = Math.pow(Math.max(0, edge), 1.6) * height + noise(px * 0.42 + seed, pz * 0.45) * Math.max(0, edge) * 1.9 - 0.28;
    positions.setY(i, y);
    const rocky = noise(px * 0.48, pz * 0.48 + seed) > 0.1;
    const color = y < 0.65 ? sand.clone() : (rocky ? stone.clone() : green.clone());
    color.multiplyScalar(0.9 + noise(px * 1.5, pz * 1.5) * 0.15);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
  mesh.position.set(x, 0, z);
  mesh.receiveShadow = true;
  return mesh;
}

function palm(x: number, y: number, z: number, height: number, seed: number) {
  const group = new Group();
  group.position.set(x, y, z);
  const curve = new CatmullRomCurve3([new Vector3(), new Vector3(0.16, height * 0.5, 0), new Vector3(0.55, height, 0.2)]);
  const trunk = new Mesh(new TubeGeometry(curve, 12, 0.075, 7, false), new MeshStandardMaterial({ color: "#7a6b4f", roughness: 1 }));
  group.add(trunk);
  const leafMaterial = new MeshStandardMaterial({ color: "#355b31", side: DoubleSide, roughness: 0.85 });
  for (let leaf = 0; leaf < 9; leaf++) {
    const angle = leaf / 9 * Math.PI * 2 + seed;
    const vertices: number[] = [], indices: number[] = [];
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const reach = t * height * 0.58;
      const width = Math.sin(t * Math.PI) * 0.17;
      for (const side of [-1, 1]) vertices.push(Math.cos(angle) * reach + Math.sin(angle) * width * side, Math.sin(t * Math.PI) * 0.35 - t * t * 0.55, Math.sin(angle) * reach - Math.cos(angle) * width * side);
      if (step < 10) { const n = step * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, leafMaterial);
    mesh.position.set(0.55, height, 0.2);
    group.add(mesh);
  }
  return group;
}

export function createCoast(quality: OceanQuality) {
  const group = new Group();
  const normalMap = waterNormals();
  const timeUniform = { value: 0 };
  const wakeUniform = { value: 0.55 };
  const segments = quality === "LOW" ? 96 : 164;
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position"), uvs = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const x = Math.sign(positions.getX(i)) * Math.pow(Math.abs(positions.getX(i)), 3) * 600;
    const z = Math.sign(positions.getZ(i)) * Math.pow(Math.abs(positions.getZ(i)), 3) * 600;
    positions.setXYZ(i, x, 0, z); uvs.setXY(i, x / 1200 + 0.5, z / 1200 + 0.5);
  }
  geometry.computeBoundingSphere();
  const waterMaterial = new MeshPhysicalMaterial({ color: "#087784", roughness: 0.3, metalness: 0.05, normalMap, normalScale: new Vector2(0.3, 0.3), envMapIntensity: 0.12, transparent: true, opacity: 0.87, depthWrite: false, clearcoat: 0.1, clearcoatRoughness: 0.2 });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.oceanTime = timeUniform;
    shader.uniforms.wakeStrength = wakeUniform;
    shader.vertexShader = `uniform float oceanTime; varying vec3 vOceanPosition; ${SEA_HEIGHT_GLSL}\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "vec3 transformed = vec3(position.x, seaHeight(position.xz, oceanTime), position.z); vOceanPosition = transformed;")
      .replace("#include <beginnormal_vertex>", `float e = 0.03; float h = seaHeight(position.xz, oceanTime); vec3 objectNormal = normalize(vec3((h-seaHeight(position.xz+vec2(e,0.0),oceanTime))/e,1.0,(h-seaHeight(position.xz+vec2(0.0,e),oceanTime))/e));`);
    shader.fragmentShader = `uniform float oceanTime; uniform float wakeStrength; varying vec3 vOceanPosition;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        float behind = -vOceanPosition.z - 0.35;
        float trail = exp(-abs(abs(vOceanPosition.x) - (0.18 + behind * 0.21)) * 34.0);
        float foam = trail * smoothstep(0.0,0.3,behind) * (1.0-smoothstep(0.8,4.8,behind));
        foam *= pow(0.5+0.5*sin(behind*28.0 + oceanTime*6.0 + vOceanPosition.x*15.0),2.0) * wakeStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64,0.8,0.73), foam);
      `);
  };
  const water = new Mesh(geometry, waterMaterial);
  water.name = "OceanSurface";
  water.renderOrder = 2;
  group.add(water);
  const seabed = new Mesh(new PlaneGeometry(1200, 1200), new MeshStandardMaterial({ color: "#2a747d", roughness: 1 }));
  seabed.rotation.x = -Math.PI / 2; seabed.position.y = -4;
  group.add(seabed);
  group.add(island(-24, 38, 13, 6.5, 1), island(30, 77, 21, 12, 3), island(-70, 130, 30, 16, 4));
  for (let i = 0; i < 7; i++) {
    const angle = i * 0.68;
    const x = -24 + Math.cos(angle) * 7, z = 38 + Math.sin(angle) * 4;
    group.add(palm(x, 0.8 + i % 3 * 0.5, z, 2.6 + i % 2 * 0.9, i));
  }
  const rockMaterial = new MeshStandardMaterial({ color: "#697a70", roughness: 0.87 });
  for (let i = 0; i < 16; i++) {
    const rock = new Mesh(new IcosahedronGeometry(1, 2), rockMaterial);
    rock.position.set(-24 + Math.cos(i * 2.3) * 10.8, 0.16, 38 + Math.sin(i * 2.3) * 8.2);
    rock.scale.set(0.65 + (i % 3) * 0.2, 0.38 + (i % 4) * 0.11, 0.5 + (i % 5) * 0.13);
    rock.rotation.set(i, i * 0.7, i * 0.1); group.add(rock);
  }
  const buoy = new Mesh(new SphereGeometry(0.18, 20, 12), new MeshStandardMaterial({ color: "#d77542", roughness: 0.5 }));
  buoy.position.set(-2.8, 0.05, 7);
  group.add(buoy);

  const sprayGeometry = new BufferGeometry();
  const sprayPositions = new Float32Array(60 * 3);
  sprayGeometry.setAttribute("position", new Float32BufferAttribute(sprayPositions, 3));
  const spray = new Points(sprayGeometry, new PointsMaterial({ color: "#e1f3e9", size: 0.025, transparent: true, opacity: 0.65, depthWrite: false }));
  spray.renderOrder = 3; spray.frustumCulled = false;
  group.add(spray);
  return {
    group,
    update(time: number, phase: number, energetic: boolean, luminous: boolean) {
      timeUniform.value = time;
      normalMap.offset.set(time * 0.004, time * -0.003);
      wakeUniform.value = energetic ? 0.95 : 0.5;
      waterMaterial.envMapIntensity = luminous ? 0.16 : 0.12;
      buoy.position.y = 0.06 + seaHeight(-2.8, 7, time);
      for (let i = 0; i < 60; i++) {
        const side = i % 2 ? -1 : 1;
        const elapsed = ((phase / (Math.PI * 2) + i * 0.017 + (side === 1 ? 0 : 0.5)) % 1 + 1) % 1;
        const spread = Math.sin(i * 7.91);
        sprayPositions[i * 3] = side * 0.24 + spread * elapsed * 0.16;
        sprayPositions[i * 3 + 1] = elapsed < 0.3 ? seaHeight(side * 0.24, 0.7, time) + Math.sin(elapsed / 0.3 * Math.PI) * 0.12 : -1;
        sprayPositions[i * 3 + 2] = 0.8 - elapsed * 0.8 + Math.cos(i * 2.17) * 0.05;
      }
      // Float32BufferAttribute copies its input, so update the live GPU attribute.
      sprayGeometry.getAttribute("position").array.set(sprayPositions);
      sprayGeometry.getAttribute("position").needsUpdate = true;
    },
    dispose() {
      const geometries = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial | PointsMaterial>();
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof Points) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); normalMap.dispose();
    }
  };
}
