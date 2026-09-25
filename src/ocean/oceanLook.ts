export type OceanWeather = "SUNNY" | "CLOUDY" | "RAINY";

export const OCEAN_LOOKS = {
  SUNNY: { label: "晴天", title: "晴空海湾", description: "晴光 · 青碧浅滩", shallow: "#8cddd0", coastal: "#32afbd", deep: "#247fa9", fog: "#bbdae0", fogDensity: 0.003, sky: "#e0f3fa", ground: "#91b5ad", sun: "#fff4dc", sunIntensity: 3.0, ambient: 1.5, environment: 0.22, exposure: 0.85, roughness: 0.27, scatter: 0.16, cloud: 0.24, cloudDensity: 0.35, turbidity: 2, rayleigh: 2, rain: 0 },
  CLOUDY: { label: "阴天", title: "云下海湾", description: "柔光 · 银青海面", shallow: "#a0d0c7", coastal: "#599ea9", deep: "#467e99", fog: "#c0d0d4", fogDensity: 0.0048, sky: "#e1e9ed", ground: "#9cacac", sun: "#edf5ff", sunIntensity: 0.65, ambient: 1.8, environment: 0.18, exposure: 0.85, roughness: 0.37, scatter: 0.13, cloud: 0.88, cloudDensity: 0.8, turbidity: 7, rayleigh: 0.7, rain: 0 },
  RAINY: { label: "雨天", title: "听雨海湾", description: "细雨 · 雾蓝远海", shallow: "#87beb8", coastal: "#468e9d", deep: "#3a718f", fog: "#a4bec8", fogDensity: 0.009, sky: "#cedee6", ground: "#829ca4", sun: "#e2eeff", sunIntensity: 0.35, ambient: 1.65, environment: 0.16, exposure: 0.85, roughness: 0.43, scatter: 0.14, cloud: 0.98, cloudDensity: 1, turbidity: 10, rayleigh: 0.5, rain: 1 }
} as const;
