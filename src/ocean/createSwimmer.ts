import { Bone, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, TorusGeometry, Vector3, SkinnedMesh, TubeGeometry, CatmullRomCurve3 } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { OceanSceneProps } from "../OceanScene";
import { armDirections, breathingPose, sampleSwimEnvironment, swimLoad, type RoutePose } from "./swimMotion";

export function createSwimmer(source: Object3D) {
  const model = clone(source);
  const group = new Group();
  group.name = "SwimmingCharacter";
  const prone = new Group();
  prone.rotation.x = Math.PI / 2;
  group.add(prone);
  prone.add(model);
  const bones = new Map<string, Bone>();
  const materials: MeshStandardMaterial[] = [];
  const bodies: SkinnedMesh[] = [];
  model.traverse((object) => {
    if (object instanceof Bone) bones.set(object.name, object);
    if (object instanceof SkinnedMesh) {
      object.geometry = object.geometry.clone();
      bodies.push(object);
      object.frustumCulled = false;
      object.castShadow = true;
      const copyMaterial = (material: MeshStandardMaterial) => {
        const copy = material.clone();
        copy.envMapIntensity = 0.7;
        copy.roughness = material.name === "Skin" ? 0.54 : 0.42;
        copy.vertexColors = material.name !== "Skin";
        materials.push(copy);
        return copy;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => copyMaterial(material as MeshStandardMaterial))
        : copyMaterial(object.material as MeshStandardMaterial);
    }
  });
  const headBone = bones.get("head");
  if (!headBone) throw new Error("游泳角色缺少头部骨骼。");
  const head: Bone = headBone;
  for (const name of ["spine01", "spine03", "neck01", "oris01", "eye_L", "eye_R", ...["L", "R"].flatMap(side => ["clavicle", "upperarm01", "lowerarm01", "wrist", "upperleg01", "lowerleg01", "foot"].map(bone => `${bone}_${side}`))]) {
    if (!bones.has(name)) throw new Error(`游泳角色缺少动作骨骼：${name}`);
  }
  const capMaterial = new MeshPhysicalMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.36, clearcoat: 0.25 });
  const cap = new Mesh(new SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, 1.88), capMaterial);
  cap.name = "FittedRaceCap";
  const capPositions = cap.geometry.getAttribute("position");
  for (let i = 0; i < capPositions.count; i++) {
    // Raise the forehead edge to leave the eyes clear while covering the back of the skull.
    capPositions.setY(i, capPositions.getY(i) + Math.max(0, capPositions.getZ(i)) * (1 - capPositions.getY(i)) * 0.32);
  }
  cap.geometry.computeVertexNormals();
  cap.scale.set(0.079, 0.096, 0.102);
  cap.position.set(0, 0.057, 0.043);
  head.add(cap);
  const lensMaterial = new MeshPhysicalMaterial({ color: "#76b8ce", metalness: 0.45, roughness: 0.22, clearcoat: 0.7 });
  const strapMaterial = new MeshStandardMaterial({ color: "#263c42", roughness: 0.58 });
  const accessoryGeometries: BufferGeometry[] = [cap.geometry];
  for (const side of [-1, 1]) {
    const lensGeometry = new SphereGeometry(1, 16, 10);
    accessoryGeometries.push(lensGeometry);
    const lens = new Mesh(lensGeometry, lensMaterial);
    lens.name = `RaceLens_${side === 1 ? "L" : "R"}`;
    lens.position.set(0, 0, 0.024);
    lens.scale.set(0.029, 0.018, 0.009);
    const eye = bones.get(`eye_${side === 1 ? "L" : "R"}`)!;
    eye.add(lens);
    const rimGeometry = new TorusGeometry(1, 0.11, 8, 32);
    accessoryGeometries.push(rimGeometry);
    const rim = new Mesh(rimGeometry, strapMaterial);
    rim.scale.set(0.032, 0.021, 0.022);
    rim.position.set(0, 0, 0.021);
    eye.add(rim);
  }
  const strapGeometry = new TorusGeometry(1, 0.026, 6, 48);
  accessoryGeometries.push(strapGeometry);
  const strap = new Mesh(strapGeometry, strapMaterial);
  strap.rotation.x = Math.PI / 2;
  strap.scale.set(0.081, 0.10, 0.081);
  strap.position.set(0, 0.035, 0.043);
  head.add(strap);
  const bridgeGeometry = new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.012, 0.031, 0.132), new Vector3(0, 0.037, 0.137), new Vector3(0.012, 0.031, 0.132)]), 10, 0.0025, 6, false);
  accessoryGeometries.push(bridgeGeometry);
  head.add(new Mesh(bridgeGeometry, strapMaterial));

  const direction = new Vector3();
  const inverse = new Quaternion();
  const referenceRotation = new Quaternion();
  const rest = new Map<string, Vector3>();
  bones.forEach((bone, name) => { rest.set(name, new Vector3().fromArray(bone.userData.restDirection ?? [0, 1, 0])); });
  model.updateMatrixWorld(true);
  for (const side of ["L", "R"]) {
    // MakeHuman has intermediate twist bones; aim at the next joint, not the short twist segment.
    for (const [from, to] of [["upperarm01", "lowerarm01"], ["lowerarm01", "wrist"], ["upperleg01", "lowerleg01"], ["lowerleg01", "foot"]]) {
      const start = bones.get(`${from}_${side}`)!, end = bones.get(`${to}_${side}`)!;
      rest.set(start.name, model.worldToLocal(end.getWorldPosition(new Vector3())).sub(model.worldToLocal(start.getWorldPosition(new Vector3()))).normalize());
    }
  }
  function aim(name: string, target: [number, number, number], reference: Object3D = model) {
    const bone = bones.get(name);
    if (!bone) return;
    direction.fromArray(target).normalize();
    reference.getWorldQuaternion(referenceRotation);
    bone.parent!.getWorldQuaternion(inverse).invert();
    direction.applyQuaternion(referenceRotation).applyQuaternion(inverse);
    bone.quaternion.setFromUnitVectors(rest.get(name)!, direction);
  }
  function setAppearance(props: Pick<OceanSceneProps, "avatarStyle" | "proportions">) {
    const female = props.avatarStyle === "FEMALE";
    const base = new Color(female ? "#172e35" : "#122f49");
    const accent = new Color(female ? "#30cbae" : "#60aecb");
    const trim = new Color(female ? "#e6f3df" : "#d4e8ee");
    materials.forEach((material) => {
      material.color.set(material.name === "Skin" ? "#cc997c" : "#ffffff");
    });
    bodies.forEach(body => {
      const positions = body.geometry.getAttribute("position"), colors = new Float32Array(positions.count * 3);
      const color = new Color();
      for (let i = 0; i < positions.count; i++) {
        const x = Math.abs(positions.getX(i)), y = positions.getY(i);
        const seam = Math.abs(x - (0.105 + Math.max(0, y - 0.1) * 0.14));
        const torso = y > 0.08 && y < 0.48;
        const stripe = torso ? 1 - Math.min(1, Math.max(0, (seam - 0.01) / 0.01)) : 0;
        color.copy(base).lerp(accent, torso && x > 0.14 ? 0.48 : 0);
        color.lerp(trim, stripe * 0.9);
        if (y > 0.38 && y < 0.46 && x > 0.19) color.lerp(accent, 0.75);
        color.toArray(colors, i * 3);
      }
      body.geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    });
    const capColors = new Float32Array(capPositions.count * 3), capBase = new Color(female ? "#e3eee8" : "#243e52");
    const color = new Color();
    for (let i = 0; i < capPositions.count; i++) {
      const stripe = Math.abs(Math.abs(capPositions.getX(i)) - 0.38) < 0.065;
      color.copy(stripe ? accent : capBase).toArray(capColors, i * 3);
    }
    cap.geometry.setAttribute("color", new Float32BufferAttribute(capColors, 3));
    lensMaterial.color.set(female ? "#79d8c1" : "#91bedb");
    model.scale.set(props.proportions.bodyWidth * (female ? 1 : 1.035), props.proportions.strokeReach, 1);
    bones.get("spine03")!.scale.x = female ? 0.97 : 0.98;
    bones.get("spine01")!.scale.x = female ? 1.025 : 1.09;
    head.scale.set(female ? 0.98 : 0.99, 1, 1);
  }
  const hands = [new Vector3(), new Vector3()] as const;
  const mouth = new Vector3();
  const neck = bones.get("neck01")!;
  const lips = bones.get("oris01")!;
  let lastTime: number | undefined;
  let floatingHeight = 0, pitch = 0, roll = 0;
  function update(time: number, phase: number, pose: RoutePose, waterHeight: (x: number, z: number, time: number) => number) {
    const c = Math.cos(pose.heading), s = Math.sin(pose.heading);
    const height = (x: number, z: number) => waterHeight(pose.x + x*c + z*s, pose.z - x*s + z*c, time);
    const environment = sampleSwimEnvironment(pose, time), load = swimLoad(environment);
    const surface = height(0, 0);
    const dt = lastTime === undefined ? 0 : Math.max(0, Math.min(0.05, time - lastTime));
    const blend = lastTime === undefined || time < lastTime ? 1 : 1 - Math.exp(-dt * 7);
    floatingHeight += (surface - floatingHeight) * blend;
    floatingHeight = Math.max(surface - 0.035, Math.min(surface + 0.035, floatingHeight));
    pitch += (Math.atan2(height(0, -0.6) - height(0, 0.6), 1.2) - pitch) * blend;
    roll += (Math.atan2(height(0.4, 0) - height(-0.4, 0), 0.8) - roll) * blend;
    lastTime = time;
    group.position.set(pose.x, 0.065 + floatingHeight, pose.z);
    group.rotation.set(Math.max(-0.18, Math.min(0.18, pitch)), pose.heading, Math.max(-0.16, Math.min(0.16, roll)), "YXZ");
    const strokeRoll = -Math.sin(phase - 0.18);
    const breath = breathingPose(phase), inhale = Math.abs(breath);
    prone.rotation.y = strokeRoll * 0.12;
    bones.get("spine03")!.rotation.set(0.015 * Math.sin(phase * 2), -Math.sin(phase - 0.65) * 0.055, 0);
    const shoulders = bones.get("spine01")!;
    shoulders.rotation.set(-0.18 * inhale - Math.min(0.025, Math.abs(environment.verticalVelocity) * 0.04), strokeRoll * 0.16 + breath * 0.18, Math.max(-0.035, Math.min(0.035, environment.crossFlow * 0.08)));
    neck.rotation.set(-0.12 * inhale, breath * 0.12, 0);
    head.rotation.set(-0.06 - inhale * 0.10, breath * 1.05, -strokeRoll * 0.05);
    // Check the actual lip joint against the local water, not the pelvis height.
    // A bounded neck extension clears small crests without translating the skeleton.
    for (let attempt = 0; attempt < 3 && inhale > 0; attempt++) {
      lips.getWorldPosition(mouth);
      const deficit = waterHeight(mouth.x, mouth.z, time) + 0.025 - mouth.y;
      neck.rotation.x -= Math.min(0.12, Math.max(0, deficit) * 4) * inhale;
    }
    for (const side of [-1, 1] as const) {
      const suffix = side === 1 ? "L" : "R";
      const angle = phase + (side === 1 ? 0 : Math.PI);
      const stroke = armDirections(angle, side, load);
      const t = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
      const recovery = t > 0.65 ? Math.sin((t - 0.65) / 0.35 * Math.PI) ** 2 : 0;
      bones.get(`clavicle_${suffix}`)!.rotation.z = side * (0.025 + recovery * 0.055);
      aim(`upperarm01_${suffix}`, stroke.upper, shoulders);
      aim(`lowerarm01_${suffix}`, stroke.lower, shoulders);
      aim(`wrist_${suffix}`, [stroke.lower[0] * 0.4, stroke.lower[1], stroke.lower[2] + 0.10 * (1 - recovery)], shoulders);
      const kickPhase = phase * 3 + (side === 1 ? 0 : Math.PI);
      const kickStrength = 0.12 + Math.max(0, load) * 0.09;
      aim(`upperleg01_${suffix}`, [side * 0.025, -1, 0.035 + Math.sin(kickPhase) * kickStrength]);
      aim(`lowerleg01_${suffix}`, [side * 0.025, -1, -0.04 + Math.sin(kickPhase - 0.65) * kickStrength * 1.25]);
      aim(`foot_${suffix}`, [side * 0.035, -0.98, 0.10 + Math.sin(kickPhase - 1.05) * 0.08]);
    }
    group.updateMatrixWorld(true);
    bones.get("wrist_L")!.getWorldPosition(hands[0]);
    bones.get("wrist_R")!.getWorldPosition(hands[1]);
    lips.getWorldPosition(mouth);
  }
  return {
    group, hands, mouth, setAppearance, update,
    dispose() {
      materials.forEach((material) => material.dispose());
      bodies.forEach(body => body.geometry.dispose());
      accessoryGeometries.forEach((geometry) => geometry.dispose());
      capMaterial.dispose(); lensMaterial.dispose(); strapMaterial.dispose();
      const skeletons = new Set<SkinnedMesh["skeleton"]>();
      model.traverse((object) => { if (object instanceof SkinnedMesh) skeletons.add(object.skeleton); });
      skeletons.forEach((skeleton) => skeleton.dispose());
    }
  };
}
