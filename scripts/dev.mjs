import { spawn } from "node:child_process"
import process from "node:process"

const children = []
const webPort = Number(process.env.PORT || 4444)
const webUrl = `http://127.0.0.1:${webPort}`
const localWebUrl = `http://localhost:${webPort}`
const apiPort = Number(process.env.API_PORT || 4445)
const apiUrl = `http://127.0.0.1:${apiPort}/health`

function start(label, args, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    ...options,
  })

  children.push(child)

  child.on("exit", (code, signal) => {
    if (signal === "SIGINT" || signal === "SIGTERM") return
    console.log(`[${label}] exited with code=${code} signal=${signal ?? "null"}`)
    shutdown(code ?? 1)
  })

  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
  process.exit(code)
}

async function isServiceReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" })
    return response.ok
  } catch {
    return false
  }
}

const webAlreadyRunning = await isServiceReachable(webUrl)
if (webAlreadyRunning) {
  console.log(`Reusing existing frontend at ${webUrl}`)
} else {
  start("web", ["./scripts/frontend-server.mjs"], {
    env: {
      ...process.env,
      PORT: String(webPort),
      NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
    },
  })
}

const apiAlreadyRunning = await isServiceReachable(apiUrl)
if (apiAlreadyRunning) {
  console.log(`Reusing existing API at ${apiUrl}`)
} else {
  start("api", ["./backend/scripts/dev.mjs"], {
    env: {
      ...process.env,
      PORT: String(apiPort),
      NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
      CORS_ORIGINS: `${webUrl},${localWebUrl}`,
    },
  })
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))
