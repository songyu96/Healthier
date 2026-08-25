import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: { "virtual:pwa-register": fileURLToPath(new URL("./src/test/pwaRegisterStub.ts", import.meta.url)) },
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    pool: "threads",
    maxWorkers: 1,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
