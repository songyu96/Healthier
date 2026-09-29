// @vitest-environment node
import { readFileSync } from "node:fs";
import { Bone, Box3, Mesh, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createSwimmer } from "./createSwimmer";
import { advanceSwim, breathingPose, routePose, seaHeight, type SwimClock } from "./swimMotion";

describe.each(["MALE", "FEMALE"] as const)("%s Coral C asset", avatarStyle => {
  let source: Awaited<ReturnType<GLTFLoader["parseAsync"]>>["scene"];
  beforeAll(async () => {
    const bytes = readFileSync(`src/ocean/assets/swimmer-${avatarStyle.toLowerCase()}.glb`);
    source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
  });
  const appearance = { avatarStyle, proportions: { bodyWidth: 1, strokeReach: 1 } };
  it("独立衣物网格与有效蒙皮；预览发型和游泳装备互斥且不修改源资产", () => {
    const swimmer = createSwimmer(source), other = createSwimmer(source);
    try {
      swimmer.setAppearance(appearance);
      const framing = swimmer.setPreviewPose();
      expect(framing.height).toBeGreaterThan(1.5);
      expect(framing.height).toBeLessThan(2);
      expect(swimmer.group.getObjectByName("PreviewHair")?.visible).toBe(true);
      expect(swimmer.group.getObjectByName("SwimEquipment")?.visible).toBe(false);
      expect(other.group.getObjectByName("PreviewHair")?.visible).toBe(false);
      expect(source.getObjectByName("PreviewHair")?.visible).toBe(true);
      const geometries = new Set<Mesh["geometry"]>();
      source.traverse(o => { if (o instanceof Mesh) geometries.add(o.geometry); });
      let garments = 0;
      swimmer.group.traverse(o => {
        if (o instanceof Mesh) expect(geometries.has(o.geometry)).toBe(false);
        if (!(o instanceof SkinnedMesh)) return;
        if (/CoralTop|TealSwimShorts/.test(o.name)) garments++;
        const weights = o.geometry.getAttribute("skinWeight"), indices = o.geometry.getAttribute("skinIndex");
        for (let i = 0; i < weights.count; i++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) {
            const w = weights.getComponent(i,j);sum += w;
            expect(w).toBeGreaterThanOrEqual(0);
            expect(indices.getComponent(i,j)).toBeLessThan(o.skeleton.bones.length);
          }
          expect(sum).toBeCloseTo(1,5);
          if (/CoralTop|TopSidePanels/.test(o.name)) {
            let armWeight = 0, handWeight = 0;
            for (let j = 0; j < 4; j++) {
              const bone = o.skeleton.bones[indices.getComponent(i,j)].name;
              if (/upperarm|lowerarm|wrist|finger|metacarpal/.test(bone)) armWeight += weights.getComponent(i,j);
              if (/wrist|finger|metacarpal/.test(bone)) handWeight += weights.getComponent(i,j);
            }
            if (avatarStyle === "FEMALE") expect(armWeight).toBeLessThan(0.2);
            expect(handWeight).toBeLessThan(0.01);
          }
        }
      });
      expect(garments).toBeGreaterThanOrEqual(2);
      swimmer.update(0,0,routePose(0),seaHeight);
      expect(swimmer.group.getObjectByName("PreviewHair")?.visible).toBe(false);
      expect(swimmer.group.getObjectByName("SwimEquipment")?.visible).toBe(true);
      source.traverse(o => { if (o instanceof Bone) expect(o.quaternion.toArray()).toEqual([0,0,0,1]); });
    } finally { swimmer.dispose();other.dispose(); }
  });
  it.each(["EASY", "STEADY", "SURGE"] as const)("%s 换气采样与可见嘴部一致，左右吸气露出水面，衣服关节不爆开", pace => {
    const swimmer = createSwimmer(source);
    swimmer.setAppearance(appearance);
    let clock: SwimClock = { time: 0, phase: 0, distance: 0 };
    let left = 0, right = 0, submerged = 0;
    const mouth = swimmer.group.getObjectByName("MouthLine") as Mesh;
    const mouthCenter = new Vector3();mouth.geometry.computeBoundingBox();mouth.geometry.boundingBox!.getCenter(mouthCenter);
    try {
      for (let i = 0; i < 1200; i++) {
        clock = advanceSwim(clock,1/60,pace,false);
        swimmer.update(clock.time,clock.phase,routePose(clock.distance),seaHeight);
        const visibleMouth = mouth.localToWorld(mouthCenter.clone());
        expect(visibleMouth.distanceTo(swimmer.mouth)).toBeLessThan(0.006);
        const clearance = visibleMouth.y-seaHeight(visibleMouth.x,visibleMouth.z,clock.time);
        const breath = breathingPose(clock.phase);
        if (Math.abs(breath)>0.99) { expect(clearance).toBeGreaterThan(0.003);if(breath>0)left++;else right++; }
        if(breath===0&&clearance<-.02)submerged++;
        if(i%120===0) {
          const box = new Box3(), vertex = new Vector3();
          swimmer.group.traverse(o => {
            if (!(o instanceof SkinnedMesh)) return;
            const p=o.geometry.getAttribute("position");
            for(let j=0;j<p.count;j+=13) {o.applyBoneTransform(j,vertex.fromBufferAttribute(p,j));box.expandByPoint(o.localToWorld(vertex));}
          });
          const size=box.getSize(new Vector3());
          expect(size.x).toBeLessThan(2);expect(size.y).toBeLessThan(1.6);expect(size.z).toBeLessThan(3);
        }
      }
      expect(left).toBeGreaterThan(20);expect(right).toBeGreaterThan(20);expect(submerged).toBeGreaterThan(100);
    } finally { swimmer.dispose(); }
  });
});
