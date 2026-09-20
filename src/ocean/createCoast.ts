import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, Material, Mesh, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { MAX_SEA_HEIGHT, routePose, ROUTE_RADIUS, seaHeight, type OceanQuality, type RoutePose } from "./swimMotion";
import { createWater } from "./createWater";

function noise(x: number, z: number): number {
  return Math.sin(x * 1.7 + Math.sin(z * 0.83)) * 0.5 + Math.sin(z * 2.13 - x * 0.37) * 0.25 + Math.sin(x * 4.17 + z * 3.16) * 0.125;
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
    // Lower the offshore skirt below every wave trough without moving the island inland.
    const skirt = Math.max(0, Math.min(1, (0.15 - edge) / 0.15));
    const seabedDrop = (MAX_SEA_HEIGHT + 0.5) * skirt * skirt * (3 - 2 * skirt);
    const y = Math.pow(Math.max(0, edge), 1.6) * height + noise(px * 0.42 + seed, pz * 0.45) * Math.max(0, edge) * 1.9 - 0.28 - seabedDrop;
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
  sprayGeometry.setAttribute("position", new Float32BufferAttribute(sprayPositions, 3));
  const spray = new Points(sprayGeometry, new PointsMaterial({ color: "#e1f3e9", size: 0.025, transparent: true, opacity: 0.65, depthWrite: false }));
  spray.renderOrder = 3; spray.frustumCulled = false;
  group.add(spray);
  return {
    group,
    update(time: number, phase: number, pose: RoutePose, energetic: boolean, luminous: boolean) {
      water.update(time, pose, energetic, luminous);
      buoys.forEach((buoy) => { buoy.position.y = 0.06 + seaHeight(buoy.position.x, buoy.position.z, time); });
      const c = Math.cos(pose.heading), s = Math.sin(pose.heading);
      for (let i = 0; i < 60; i++) {
        const side = i % 2 ? -1 : 1;
        const elapsed = ((phase / (Math.PI * 2) + i * 0.017 + (side === 1 ? 0 : 0.5)) % 1 + 1) % 1;
        const spread = Math.sin(i * 7.91);
        const x = side * 0.24 + spread * elapsed * 0.16;
        const z = 0.8 - elapsed * 0.8 + Math.cos(i * 2.17) * 0.05;
        const worldX = pose.x + x*c + z*s, worldZ = pose.z - x*s + z*c;
        sprayPositions[i * 3] = worldX;
        sprayPositions[i * 3 + 1] = elapsed < 0.3 ? seaHeight(worldX, worldZ, time) + Math.sin(elapsed / 0.3 * Math.PI) * 0.12 : -100;
        sprayPositions[i * 3 + 2] = worldZ;
      }
      // Float32BufferAttribute copies its input, so update the live GPU attribute.
      sprayGeometry.getAttribute("position").array.set(sprayPositions);
      sprayGeometry.getAttribute("position").needsUpdate = true;
    },
    dispose() {
      const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof Points) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
    }
  };
}
