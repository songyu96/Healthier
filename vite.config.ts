import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA, type VitePluginPWAAPI } from "vite-plugin-pwa";

const pwaPlugins = VitePWA({
  registerType: "prompt",
  includeAssets: ["favicon.svg"],
  manifest: {
    name: "Healthier · 书本饮食助手",
    short_name: "Healthier",
    description: "依据《你是你吃出来的》系列规则记录并改善日常饮食",
    lang: "zh-CN",
    theme_color: "#1f5c4a",
    background_color: "#f7f4ec",
    display: "standalone",
    scope: "/Healthier/",
    start_url: "/Healthier/#/",
    icons: [
      {
        src: "pwa-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  }
});

const pwaApi = (pwaPlugins[0] as Plugin & { api: VitePluginPWAAPI }).api;
const pwaBuildPlugin = pwaPlugins.find((plugin) => plugin.name === "vite-plugin-pwa:build");
if (!pwaBuildPlugin) throw new Error("未找到 vite-plugin-pwa 构建插件。");
// Vite 8/Rolldown 下对象形式的 closeBundle 可能跳过或重复执行；统一在 writeBundle 生成一次。
pwaBuildPlugin.closeBundle = undefined;

const ensureVite8ServiceWorker: Plugin = {
  name: "healthier:ensure-vite8-service-worker",
  apply: "build",
  enforce: "post",
  async writeBundle() {
    try {
      await access(resolve("dist/sw.js"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await pwaApi.generateSW();
    }
  }
};

export default defineConfig({
  base: "/Healthier/",
  plugins: [
    react(),
    ...pwaPlugins,
    ensureVite8ServiceWorker
  ]
});

