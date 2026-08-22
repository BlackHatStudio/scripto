import { spawn, spawnSync } from "node:child_process"
import { watch } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import dotenv from "dotenv"

const rootDir = new URL("..", import.meta.url)

dotenv.config({ path: path.resolve(fileURLToPath(rootDir), ".env") })

function compileOnce() {
  const result = spawnSync(
    process.execPath,
    ["../node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
    { cwd: rootDir, stdio: "inherit", shell: false }
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

compileOnce()
console.log("Backend TypeScript compiled. Starting watch mode and API server...")

let server = startServer()
let restartTimer

function startServer() {
  const child = spawn(process.execPath, ["dist/src/index.js"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  })
  console.log("Scripto backend server process started.")
  return child
}

function restartServer() {
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    server.kill()
    server = startServer()
  }, 200)
}

watch(new URL("../dist/src", import.meta.url), { recursive: true }, restartServer)
process.on("SIGINT", () => {
  server.kill()
  process.exit(0)
})
