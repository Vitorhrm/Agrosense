import { defineConfig, mergeConfig } from "vite"
import base from "./vite.config.ts"

// A mesma interface Ã© usada no navegador e no APK; muda somente a saÃ­da.
export default mergeConfig(base, defineConfig({
  build: { outDir: "../app/src/main/assets/agrosense", emptyOutDir: true, target: "es2020" },
}))
