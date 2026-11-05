import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"

const frontend = fileURLToPath(new URL("../frontend/", import.meta.url))
for (const [script, args] of [
  ["typescript/bin/tsc", ["--noEmit"]],
  ["vite/bin/vite.js", ["build", "--config", "vite.android.config.ts"]],
]) {
  const executable = `${frontend}/node_modules/${script}`
  if (!existsSync(executable)) throw new Error("Instale as dependências: cd frontend && npm ci")
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: frontend, stdio: "inherit" })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
