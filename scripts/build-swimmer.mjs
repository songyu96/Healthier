// Convert MakeHuman's CC0 mesh + skin weights into the self-contained swimmer.
// Usage: node scripts/build-swimmer.mjs <directory containing the source files>
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Bone, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, MeshStandardMaterial, Skeleton, SkinnedMesh, Group, Vector3 } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const sourceDir = process.argv[2];
if (!sourceDir) throw new Error("Pass the MakeHuman source directory as the first argument.");
const obj = await readFile(join(sourceDir, "base.obj"), "utf8");
const rig = JSON.parse(await readFile(join(sourceDir, "default.mhskel"), "utf8"));
const weights = JSON.parse(await readFile(join(sourceDir, "default_weights.mhw"), "utf8")).weights;
const commit = (await readFile(join(sourceDir, "commit.txt"), "utf8")).trim();
const vertices = [];
const faces = [];
let groupName = "";
for (const line of obj.split(/\r?\n/)) {
  const [kind, ...values] = line.trim().split(/\s+/);
  if (kind === "v") vertices.push(new Vector3(...values.map(Number)).multiplyScalar(0.1));
  if (kind === "g") groupName = values[0];
  if (kind === "f" && groupName === "body") {
    const indices = values.map((value) => Number(value.split("/")[0]) - 1);
    for (let i = 1; i < indices.length - 1; i++) faces.push([indices[0], indices[i], indices[i + 1]]);
  }
}
function joint(name) {
  const indices = Array.isArray(rig.joints[name]) ? rig.joints[name] : [rig.joints[name]];
  const center = new Vector3();
  indices.forEach((index) => center.add(vertices[index]));
  return center.divideScalar(indices.length);
}
const origin = joint(rig.bones.root.head);
const boneNames = Object.keys(rig.bones);
const bones = new Map(boneNames.map((name) => [name, new Bone()]));
const model = new Group();
model.name = "OpenWaterSwimmer";
for (const [name, definition] of Object.entries(rig.bones)) {
  const bone = bones.get(name);
  bone.name = name.replace(/[^\w]/g, "_");
  const head = joint(definition.head);
  const parentHead = definition.parent ? joint(rig.bones[definition.parent].head) : origin;
  bone.position.copy(head).sub(parentHead);
  bone.userData.restDirection = joint(definition.tail).sub(head).normalize().toArray();
  if (definition.parent) bones.get(definition.parent).add(bone);
  else model.add(bone);
}
const usedVertices = [...new Set(faces.flat())].sort((a, b) => a - b);
const compactIndex = new Map(usedVertices.map((id, index) => [id, index]));
const influences = new Map(usedVertices.map((id) => [id, []]));
boneNames.forEach((name, boneIndex) => {
  for (const [vertex, weight] of weights[name] ?? []) influences.get(vertex)?.push([boneIndex, weight]);
});
const positions = [], skinIndices = [], skinWeights = [];
for (const id of usedVertices) {
  positions.push(...vertices[id].clone().sub(origin).toArray());
  const links = influences.get(id).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!links.length) throw new Error(`Missing skin weights for body vertex ${id}`);
  const sum = links.reduce((total, item) => total + item[1], 0);
  for (let i = 0; i < 4; i++) {
    skinIndices.push(links[i]?.[0] ?? 0);
    skinWeights.push((links[i]?.[1] ?? 0) / sum);
  }
}
const neckHeight = joint(rig.bones.neck01.head).y;
const ankleHeight = joint(rig.bones["foot.L"].head).y;
const materialFaces = [[], [], []];
for (const face of faces) {
  const center = face.reduce((sum, id) => sum.add(vertices[id]), new Vector3()).divideScalar(3);
  const hand = face.every((id) => influences.get(id).some(([bone, weight]) => /wrist|finger/.test(boneNames[bone]) && weight > 0.25));
  const skin = center.y > neckHeight + 0.015 || center.y < ankleHeight + 0.025 || hand;
  const panel = Math.abs(center.x) > 0.115 && center.y > origin.y + 0.10 && center.y < neckHeight - 0.035;
  materialFaces[skin ? 0 : panel ? 2 : 1].push(...face.map((id) => compactIndex.get(id)));
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
geometry.setIndex(materialFaces.flat());
let offset = 0;
materialFaces.forEach((indices, material) => { geometry.addGroup(offset, indices.length, material); offset += indices.length; });
geometry.computeVertexNormals();
const materials = [
  new MeshStandardMaterial({ name: "Skin", color: "#c78f70", roughness: 0.48 }),
  new MeshStandardMaterial({ name: "Neoprene", color: "#142b34", roughness: 0.38 }),
  new MeshStandardMaterial({ name: "SuitPanel", color: "#398b9a", roughness: 0.32 })
];
const mesh = new SkinnedMesh(geometry, materials);
mesh.name = "SwimmerBody";
model.add(mesh);
model.updateMatrixWorld(true);
mesh.bind(new Skeleton(boneNames.map((name) => bones.get(name))));
model.userData.source = `MakeHuman CC0 / ${commit}`;
model.userData.headCenter = joint(rig.bones.head.tail).sub(origin).toArray();

// GLTFExporter uses FileReader for binary buffers; Node provides Blob but not FileReader.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};
const outputDir = resolve("src/ocean/assets");
await mkdir(outputDir, { recursive: true });
const binary = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
await writeFile(join(outputDir, "swimmer.glb"), Buffer.from(binary));
await copyFile(join(sourceDir, "LICENSE.ASSETS.md"), join(outputDir, "LICENSE.MakeHuman.md"));
const hashes = await Promise.all(["base.obj", "default.mhskel", "default_weights.mhw"].map(async (file) => `${file}: ${createHash("sha256").update(await readFile(join(sourceDir, file))).digest("hex")}`));
await writeFile(join(outputDir, "README.md"), `# Swimmer asset\n\nDerived from the MakeHuman project's CC0 hm08 base mesh, default skeleton and skin weights.\n\nSource revision: ${commit}\nSource: https://github.com/makehumancommunity/makehuman/tree/${commit}/makehuman/data\nLicense: CC0 1.0 Universal; see LICENSE.MakeHuman.md.\n\nChanges: removed helper geometry, retained the four strongest skin influences, converted units to meters, added swimming-suit material regions and exported a self-contained GLB. Swimming poses and accessories are authored in this project. The prototype uses one base mesh for both selectable appearances.\n\nTo rebuild, download 3dobjs/base.obj, rigs/default.mhskel, rigs/default_weights.mhw from that revision, plus the root LICENSE.ASSETS.md. Write the revision to commit.txt alongside them, then run:\n\n\`node scripts/build-swimmer.mjs <source-directory>\`\n\nSource SHA-256:\n\n\`\`\`\n${hashes.join("\n")}\n\`\`\`\n`, "utf8");
console.log(JSON.stringify({ vertices: usedVertices.length, triangles: faces.length, bones: boneNames.length, bytes: binary.byteLength, origin: origin.toArray(), head: joint(rig.bones.head.head).sub(origin).toArray(), headTop: joint(rig.bones.head.tail).sub(origin).toArray() }));
