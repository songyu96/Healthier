import { access, readFile, readdir } from "node:fs/promises";

const requiredFiles = [
  "dist/index.html",
  "dist/manifest.webmanifest",
  "dist/sw.js",
  "dist/pwa-192x192.png",
  "dist/pwa-512x512.png"
];

await Promise.all(requiredFiles.map((path) => access(path)));

const [indexHtml, manifestText, serviceWorker] = await Promise.all([
  readFile("dist/index.html", "utf8"),
  readFile("dist/manifest.webmanifest", "utf8"),
  readFile("dist/sw.js", "utf8")
]);
const manifest = JSON.parse(manifestText);
const assetFiles = await readdir("dist/assets");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.scope === "/Healthier/", "manifest scope 必须是 /Healthier/");
assert(manifest.start_url === "/Healthier/#/", "manifest start_url 必须使用 /Healthier/#/");
assert(manifest.lang === "zh-CN", "manifest lang 必须是 zh-CN");
assert(indexHtml.includes("/Healthier/assets/"), "构建入口资源没有使用 /Healthier/ base");
assert(indexHtml.includes("manifest.webmanifest"), "index.html 未引用 manifest");
assert(serviceWorker.includes("manifest.webmanifest"), "Service Worker 预缓存未包含 manifest");
assert(!indexHtml.includes("history fallback"), "HashRouter 部署不应依赖 history fallback");
const journeyAssets = assetFiles.filter((name) => name.startsWith("journey-") && name.endsWith(".webp"));
assert(journeyAssets.length === 5, "构建产物必须包含五张旅程插画");
journeyAssets.forEach((name) => assert(!serviceWorker.includes(name), `旅程插画不应进入预缓存：${name}`));
assert(serviceWorker.includes("healthier-journey-art-v1"), "Service Worker 缺少旅程插画运行时缓存");

console.log("PWA artifact verification passed: /Healthier/#/ and static assets are self-contained.");
