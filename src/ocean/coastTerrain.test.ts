import { describe, expect, it } from "vitest";
import { ISLANDS, SEABED_HEIGHT, islandHeight, seabedHeight } from "./coastTerrain";

describe("coastal depth", () => {
  it("岛屿中心露出水面，浅滩连续过渡到深海，远海不跟随人物移动", () => {
    for (const island of ISLANDS) {
      expect(seabedHeight(island.x,island.z)).toBeGreaterThan(4);
      let shallow = 0, coastal = 0, deep = 0;
      let previous = islandHeight(0,0,island.radius,island.height,island.seed);
      for (let x = 0.01; x <= island.radius*1.35; x += 0.01) {
        const ground = islandHeight(x,0,island.radius,island.height,island.seed);
        expect(Math.abs(ground-previous)).toBeLessThan(0.2);
        if (ground < 0 && ground > -4) shallow++;
        if (ground <= -4 && ground > -14) coastal++;
        if (ground <= -14) deep++;
        previous = ground;
      }
      expect(shallow).toBeGreaterThan(5);
      expect(coastal).toBeGreaterThan(5);
      expect(deep).toBeGreaterThan(5);
    }
    expect(seabedHeight(400,400)).toBe(SEABED_HEIGHT);
    expect(seabedHeight(-400,-400)).toBe(SEABED_HEIGHT);
  });
});
