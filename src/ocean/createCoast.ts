import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, LineBasicMaterial, LineSegments, Material, Mesh, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { routePose, ROUTE_RADIUS, type OceanQuality, type RoutePose } from "./swimMotion";
import { createWater } from "./createWater";
import { ISLANDS, SEABED_HEIGHT, islandHeight, terrainNoise as noise } from "./coastTerrain";
import type { OceanWeather } from "./oceanLook";

function island(x: number, z: number, radius: number, height: number, seed: number) {
  const geometry = new PlaneGeometry(radius * 2.7, radius * 2.7, 72, 72);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const sand = new Color("#c8bb95"), stone = new Color("#70776c"), green = new Color("#435d39");
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), pz = positions.getZ(i);
    const y = islandHeight(px, pz, radius, height, seed);
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
  const water = createWater(quality);
  group.add(water.mesh);
  const seabed = new Mesh(new PlaneGeometry(1200, 1200), new MeshStandardMaterial({ color: "#b7c9bc", roughness: 1 }));
  seabed.rotation.x = -Math.PI / 2; seabed.position.y = SEABED_HEIGHT;
  group.add(seabed);
  group.add(...ISLANDS.map(i => island(i.x, i.z, i.radius, i.height, i.seed)));
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
  const buoyGeometry = new SphereGeometry(0.18, 20, 12);
  const buoyMaterial = new MeshStandardMaterial({ color: "#e18b46", roughness: 0.5 });
  const buoys = Array.from({ length: 36 }, (_, i) => {
    const pose = routePose(7 + i / 36 * ROUTE_RADIUS * Math.PI * 2);
    const buoy = new Mesh(buoyGeometry, buoyMaterial);
    buoy.position.set(pose.x - Math.cos(pose.heading) * 2.8, 0, pose.z + Math.sin(pose.heading) * 2.8);
    group.add(buoy);
    return buoy;
  });

  const sprayGeometry = new BufferGeometry();
  const sprayPositions = new Float32Array(60 * 3);
  const droplets = Array.from({ length: 60 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, born: -100 }));
  const previousHands = [new Vector3(), new Vector3()];
  const previousDepth = [0, 0];
  let lastSprayTime: number | undefined, nextDroplet = 0;
  sprayGeometry.setAttribute("position", new Float32BufferAttribute(sprayPositions, 3));
  const spray = new Points(sprayGeometry, new PointsMaterial({ color: "#e1f3e9", size: 0.025, transparent: true, opacity: 0.65, depthWrite: false }));
  spray.renderOrder = 3; spray.frustumCulled = false;
  group.add(spray);
  const rainGeometry = new BufferGeometry();
  const rainPositions = new Float32Array((quality === "LOW" ? 60 : 120) * 6);
  rainGeometry.setAttribute("position", new Float32BufferAttribute(rainPositions, 3));
  const rain = new LineSegments(rainGeometry, new LineBasicMaterial({ color: "#d7eaf0", transparent: true, opacity: 0.22, depthWrite: false }));
  rain.name = "CoastalRain";
  rain.visible = false;
  rain.frustumCulled = false;
  group.add(rain);
  return {
    group,
    heightAt: water.heightAt,
    setWeather(weather: OceanWeather) {
      water.setWeather(weather);
      rain.visible = weather === "RAINY";
    },
    update(time: number, _phase: number, pose: RoutePose, energetic: boolean, luminous: boolean) {
      water.update(time, pose, energetic, luminous);
      if (rain.visible) {
        const positions = rainGeometry.getAttribute("position");
        for (let i = 0; i < positions.count / 2; i++) {
          const x = pose.x + ((i * 0.618034) % 1 - 0.5) * 16;
          const z = pose.z + ((i * 0.414214) % 1 - 0.5) * 16;
          const y = 0.3 + ((i * 0.754878 + time * 0.85) % 1) * -6 + 6;
          positions.setXYZ(i*2, x, y, z);
          positions.setXYZ(i*2+1, x+0.025, y-0.18, z+0.012);
        }
        positions.needsUpdate = true;
      }
      buoys.forEach((buoy) => { buoy.position.y = 0.06 + water.heightAt(buoy.position.x, buoy.position.z, time); });
    },
    updateSpray(time: number, hands: readonly Vector3[]) {
      if (lastSprayTime === time) return;
      const dt = lastSprayTime === undefined ? 0 : time - lastSprayTime;
      hands.forEach((hand, side) => {
        const depth = hand.y - water.heightAt(hand.x, hand.z, time);
        if (dt > 0 && dt <= 0.1 && previousDepth[side] > 0 && depth <= 0) {
          const fraction = previousDepth[side] / (previousDepth[side] - depth);
          const x = previousHands[side].x + (hand.x - previousHands[side].x) * fraction;
          const z = previousHands[side].z + (hand.z - previousHands[side].z) * fraction;
          const strength = Math.min(1, (previousDepth[side] - depth) / dt * 0.35);
          for (let drop = 0; drop < 8; drop++) {
            const i = nextDroplet++ % droplets.length;
            Object.assign(droplets[i], { x, y: water.heightAt(x, z, time) + 0.012, z,
              vx: Math.sin(i * 7.91) * (0.15 + strength * 0.2), vy: 0.45 + strength * 0.7 + drop * 0.025,
              vz: Math.cos(i * 2.17) * (0.15 + strength * 0.2), born: time });
          }
        }
        previousHands[side].copy(hand);
        previousDepth[side] = depth;
      });
      droplets.forEach((drop, i) => {
        const age = time - drop.born;
        const x = drop.x + drop.vx * age, z = drop.z + drop.vz * age;
        const y = drop.y + drop.vy * age - 4.905 * age * age;
        const visible = age >= 0 && age < 0.65 && y >= water.heightAt(x, z, time);
        sprayPositions[i * 3] = visible ? x : 0;
        sprayPositions[i * 3 + 1] = visible ? y : -100;
        sprayPositions[i * 3 + 2] = visible ? z : 0;
      });
      sprayGeometry.getAttribute("position").array.set(sprayPositions);
      sprayGeometry.getAttribute("position").needsUpdate = true;
      lastSprayTime = time;
    },
    dispose() {
      const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof Points || object instanceof LineSegments) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
    }
  };
}
