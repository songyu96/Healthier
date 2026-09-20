import { Bone, BufferGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, TorusGeometry, Vector3, SkinnedMesh } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { OceanSceneProps } from "../OceanScene";
import { armDirections, type RoutePose } from "./swimMotion";

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
  model.traverse((object) => {
    if (object instanceof Bone) bones.set(object.name, object);
    if (object instanceof SkinnedMesh) {
      object.frustumCulled = false;
      object.castShadow = true;
      const copyMaterial = (material: MeshStandardMaterial) => {
        const copy = material.clone();
        copy.envMapIntensity = 0.12;
        materials.push(copy);
        return copy;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => copyMaterial(material as MeshStandardMaterial))
        : copyMaterial(object.material as MeshStandardMaterial);
    }
  });
  const head = bones.get("head");
  if (!head) throw new Error("游泳角色缺少头部骨骼。");
  const capMaterial = new MeshPhysicalMaterial({ color: "#b7d44e", roughness: 0.28, clearcoat: 0.6 });
  const cap = new Mesh(new SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.64), capMaterial);
  cap.scale.set(0.094, 0.12, 0.105);
  cap.position.set(0, 0.125, -0.019);
  head.add(cap);
  const lensMaterial = new MeshPhysicalMaterial({ color: "#5caab7", metalness: 0.6, roughness: 0.14, clearcoat: 1 });
  const strapMaterial = new MeshStandardMaterial({ color: "#263c42", roughness: 0.58 });
  const accessoryGeometries: BufferGeometry[] = [cap.geometry];
  for (const side of [-1, 1]) {
    const lensGeometry = new SphereGeometry(1, 16, 10);
    accessoryGeometries.push(lensGeometry);
    const lens = new Mesh(lensGeometry, lensMaterial);
    lens.position.set(side * 0.033, 0.075, 0.097);
    lens.scale.set(0.031, 0.021, 0.014);
    head.add(lens);
  }
  const strapGeometry = new TorusGeometry(0.092, 0.004, 6, 36);
  accessoryGeometries.push(strapGeometry);
  const strap = new Mesh(strapGeometry, strapMaterial);
  strap.rotation.x = Math.PI / 2;
  strap.scale.set(1, 1.12, 1);
  strap.position.set(0, 0.074, -0.004);
  head.add(strap);

  const direction = new Vector3();
  const inverse = new Quaternion();
  const rest = new Map<string, Vector3>();
  bones.forEach((bone, name) => { rest.set(name, new Vector3().fromArray(bone.userData.restDirection ?? [0, 1, 0])); });
  function aim(name: string, target: [number, number, number], parent?: Bone) {
    const bone = bones.get(name);
    if (!bone) return;
    direction.fromArray(target).normalize();
    if (parent) direction.applyQuaternion(inverse.copy(parent.quaternion).invert());
    bone.quaternion.setFromUnitVectors(rest.get(name)!, direction);
  }
  function setAppearance(props: OceanSceneProps) {
    const female = props.avatarStyle === "FEMALE";
    const accent = new Color(female ? "#c86c55" : "#398b9a");
    materials.forEach((material) => {
      if (material.name.startsWith("SuitPanel")) material.color.copy(accent);
    });
    capMaterial.color.set(female ? "#f3a185" : "#bbd85c");
    model.scale.set(props.proportions.bodyWidth * (female ? 0.97 : 1.03), props.proportions.strokeReach, 1);
  }
  function update(time: number, phase: number, pose: RoutePose, waterHeight: (x: number, z: number, time: number) => number) {
    const c = Math.cos(pose.heading), s = Math.sin(pose.heading);
    const height = (x: number, z: number) => waterHeight(pose.x + x*c + z*s, pose.z - x*s + z*c, time);
    group.position.set(pose.x, 0.055 + height(0, 0), pose.z);
    group.rotation.set((height(0, -0.6) - height(0, 0.6)) / 1.2, pose.heading, (height(0.4, 0) - height(-0.4, 0)) / 0.8, "YXZ");
    prone.rotation.y = Math.sin(phase) * 0.12;
    for (const side of [-1, 1] as const) {
      const suffix = side === 1 ? "L" : "R";
      const angle = phase + (side === 1 ? 0 : Math.PI);
      const pose = armDirections(angle, side);
      aim(`upperarm01_${suffix}`, pose.upper);
      aim(`lowerarm01_${suffix}`, pose.lower, bones.get(`upperarm01_${suffix}`));
      const thigh = bones.get(`upperleg01_${suffix}`);
      const shin = bones.get(`lowerleg01_${suffix}`);
      if (thigh) thigh.rotation.x = Math.sin(phase * 3 + side * Math.PI / 2) * 0.12;
      if (shin) shin.rotation.x = Math.max(0, Math.sin(phase * 3 + side * Math.PI / 2 + 0.4)) * 0.2;
    }
    const breathing = Math.pow(Math.max(0, Math.sin(phase * 0.5)), 5);
    head!.rotation.set(-0.12, breathing * 1.04, 0);
  }
  return {
    group, setAppearance, update,
    dispose() {
      materials.forEach((material) => material.dispose());
      accessoryGeometries.forEach((geometry) => geometry.dispose());
      capMaterial.dispose(); lensMaterial.dispose(); strapMaterial.dispose();
      const skeletons = new Set<SkinnedMesh["skeleton"]>();
      model.traverse((object) => { if (object instanceof SkinnedMesh) skeletons.add(object.skeleton); });
      skeletons.forEach((skeleton) => skeleton.dispose());
    }
  };
}
