import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "validate-supabase-publishable-key",
      configResolved(config) {
        const key = config.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
        if (key && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
          throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY deve conter somente uma chave pública sb_publishable_.")
        }
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
})
