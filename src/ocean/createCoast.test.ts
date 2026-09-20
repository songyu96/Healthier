import { Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createCoast } from "./createCoast";
import { MAX_SEA_HEIGHT, routePose, seaHeight } from "./swimMotion";

describe("submerged island terrain", () => {
  it("航线旁的外围沙土始终低于浪谷，不随海浪露出色块", () => {
    const coast = createCoast("LOW");
    try {
      coast.group.updateMatrixWorld(true);
      const terrain = coast.group.children.filter((object): object is Mesh<PlaneGeometry, MeshStandardMaterial> =>
        object instanceof Mesh && object.geometry instanceof PlaneGeometry && object.material instanceof MeshStandardMaterial && object.material.vertexColors
      );
      expect(terrain).toHaveLength(3);
      // This section of the swimming route crosses the first island's submerged skirt.
      const pose = routePose(40);
      const ray = new Raycaster(new Vector3(pose.x, 10, pose.z), new Vector3(0, -1, 0));
      const hits = ray.intersectObjects(terrain);
      expect(hits).toHaveLength(1);
      const ground = hits[0].point.y;
      expect(ground).toBeLessThan(-MAX_SEA_HEIGHT - 0.15);
      for (let time = 0; time < 120; time += 0.25) {
        expect(seaHeight(pose.x, pose.z, time)).toBeGreaterThan(ground);
      }
      for (const island of terrain) {
        const radius = island.geometry.parameters.width / 2.7;
        const positions = island.geometry.getAttribute("position");
        let peak = -Infinity;
        for (let i = 0; i < positions.count; i++) {
          peak = Math.max(peak, positions.getY(i));
          const distance = Math.hypot(positions.getX(i), positions.getZ(i) * Math.sqrt(1.3)) / radius;
          if (distance > 1.15) expect(positions.getY(i)).toBeLessThan(-MAX_SEA_HEIGHT - 0.15);
        }
        expect(peak).toBeGreaterThan(4);
      }
    } finally {
      coast.dispose();
    }
  });
});
