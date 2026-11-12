import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const commit = process.argv[2];
const output = resolve("public/agro");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Execute via npm run build:web.");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " falhou.");
}

let temporary;
try {
  let frontend = resolve("../APP/frontend");
  if (commit || !existsSync(join(frontend, "package.json"))) {
    if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("Informe o SHA do commit do frontend.");
    temporary = mkdtempSync(join(tmpdir(), "agrosense-web-"));
    run("git", ["init", "-q"], temporary);
    run("git", ["fetch", "-q", "--depth", "1", "https://github.com/Vitorhrm/Agrosense.git", commit], temporary);
    run("git", ["checkout", "-q", "--detach", "FETCH_HEAD"], temporary);
    frontend = join(temporary, "APP", "frontend");
  }
  run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], frontend);
  run(process.execPath, [npm, "run", "build", "--", "--base=/agro/", "--outDir", output, "--emptyOutDir"], frontend);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
