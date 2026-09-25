/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Bone, Box3, Mesh, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { OceanSceneProps } from "../OceanScene";
import { createSwimmer } from "./createSwimmer";
import { advanceSwim, breathingPose, routePose, seaHeight, type SwimClock } from "./swimMotion";

let source: Awaited<ReturnType<GLTFLoader["parseAsync"]>>["scene"];
beforeAll(async () => {
  const bytes = readFileSync(resolve("src/ocean/assets/swimmer.glb"));
  source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
});
const appearance: OceanSceneProps = { progress: 0, avatarStyle: "MALE", pace: "STEADY", proportions: { bodyWidth: 1, strokeReach: 1 }, luminousWater: false, dolphin: false, butterfly: false };

describe("swimmer on the shipped GLB", () => {
  it.each(["EASY", "STEADY", "SURGE"] as const)("%s 左右换气的吸气阶段嘴部露出浪面，收头后重新入水", (pace) => {
    for (const avatarStyle of ["MALE", "FEMALE"] as const) {
      const swimmer = createSwimmer(source);
      swimmer.setAppearance({...appearance, avatarStyle});
      let clock: SwimClock = {time:0,phase:0,distance:0};
      let left = 0, right = 0, submerged = 0;
      const previous = new Vector3();
      try {
        for (let frame = 0; frame < 1200; frame++) {
          clock = advanceSwim(clock,1/60,pace,false);
          swimmer.update(clock.time,clock.phase,routePose(clock.distance),seaHeight);
          const breath = breathingPose(clock.phase);
          const clearance = swimmer.mouth.y - seaHeight(swimmer.mouth.x,swimmer.mouth.z,clock.time);
          if (Math.abs(breath) > 0.99) {
            expect(clearance).toBeGreaterThan(0.005);
            if (breath > 0) left++; else right++;
          }
          if (breath === 0 && clearance < -0.02) submerged++;
          if (frame > 0) expect(swimmer.mouth.distanceTo(previous)).toBeLessThan(0.07);
          previous.copy(swimmer.mouth);
        }
        expect(left).toBeGreaterThan(20);
        expect(right).toBeGreaterThan(20);
        expect(submerged).toBeGreaterThan(100);
        swimmer.update(clock.time,clock.phase,routePose(clock.distance),seaHeight);
        expect(swimmer.mouth.distanceTo(previous)).toBeLessThan(0.000001);
      } finally { swimmer.dispose(); }
    }
  });
  it("动作覆盖实际骨骼，暂停不漂移，身体保持贴近水面且关节变换有限", () => {
    const swimmer = createSwimmer(source);
    swimmer.setAppearance(appearance);
    let clock: SwimClock = {time:0,phase:0,distance:0};
    let maxHandHeight = -Infinity, minHandHeight = Infinity;
    try {
      for (let frame = 0; frame < 240; frame++) {
        clock = advanceSwim(clock, 1/30, "STEADY", false);
        const pose = routePose(clock.distance);
        swimmer.update(clock.time, clock.phase, pose, seaHeight);
        expect(Math.abs(swimmer.group.position.y - seaHeight(pose.x, pose.z, clock.time) - 0.065)).toBeLessThanOrEqual(0.036);
        for (const hand of swimmer.hands) {
          const above = hand.y - seaHeight(hand.x, hand.z, clock.time);
          maxHandHeight = Math.max(maxHandHeight, above);
          minHandHeight = Math.min(minHandHeight, above);
          expect(hand.distanceTo(swimmer.group.position)).toBeLessThan(1.4);
        }
        swimmer.group.traverse(object => {
          if (object instanceof Bone) expect(object.quaternion.length()).toBeCloseTo(1, 6);
        });
      }
      expect(maxHandHeight).toBeGreaterThan(0.03);
      expect(minHandHeight).toBeLessThan(-0.12);
      const before = swimmer.hands.map(hand => hand.clone());
      swimmer.update(clock.time, clock.phase, routePose(clock.distance), seaHeight);
      swimmer.hands.forEach((hand,i) => expect(hand.distanceTo(before[i])).toBeLessThan(0.000001));
    } finally { swimmer.dispose(); }
  });
  it("男女轮廓与装备配色独立，反复切换可恢复，泳帽贴合头部", () => {
    const male = createSwimmer(source), female = createSwimmer(source);
    try {
      male.setAppearance(appearance);
      female.setAppearance({...appearance,avatarStyle:"FEMALE"});
      const maleCap = male.group.getObjectByName("FittedRaceCap") as Mesh;
      const femaleCap = female.group.getObjectByName("FittedRaceCap") as Mesh;
      const colors = Array.from(maleCap.geometry.getAttribute("color").array);
      expect(colors).not.toEqual(Array.from(femaleCap.geometry.getAttribute("color").array));
      female.setAppearance(appearance);
      expect(Array.from(femaleCap.geometry.getAttribute("color").array)).toEqual(colors);
      // Local cap top should be within 2 cm of the real GLB head top (0.1516 m above head joint).
      maleCap.updateMatrix();
      maleCap.geometry.computeBoundingBox();
      const capBounds = maleCap.geometry.boundingBox!.clone().applyMatrix4(maleCap.matrix);
      expect(capBounds.max.y).toBeGreaterThan(0.15);
      expect(capBounds.max.y).toBeLessThan(0.17);
      const sourceGeometry = new Set<SkinnedMesh["geometry"]>();
      source.traverse(object => { if (object instanceof SkinnedMesh) sourceGeometry.add(object.geometry); });
      male.group.traverse(object => { if (object instanceof SkinnedMesh) expect(sourceGeometry.has(object.geometry)).toBe(false); });
      source.traverse(object => { if (object instanceof Bone) expect(object.quaternion.toArray()).toEqual([0,0,0,1]); });
      male.update(0,0,routePose(0),seaHeight);
      // Exercise skinning, not just bone rotations: the mesh must not explode after aiming through twist bones.
      const box = new Box3(), vertex = new Vector3();
      male.group.traverse(object => {
        if (object instanceof SkinnedMesh) {
          const positions = object.geometry.getAttribute("position");
          for (let i = 0; i < positions.count; i += 7) {
            object.applyBoneTransform(i, vertex.fromBufferAttribute(positions, i));
            box.expandByPoint(object.localToWorld(vertex));
          }
        }
      });
      const size = box.getSize(new Vector3());
      expect(size.x).toBeLessThan(1.5);
      expect(size.y).toBeLessThan(1.5);
      expect(size.z).toBeLessThan(3);
    } finally { male.dispose(); female.dispose(); }
  });
});
