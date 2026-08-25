import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Healthier/",
  plugins: [
    react(),
    VitePWA({
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
    })
  ]
});

