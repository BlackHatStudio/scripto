import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const children = []
const webPort = Number(process.env.PORT || 4444)
const webUrl = `http://127.0.0.1:${webPort}`
const localWebUrl = `http://localhost:${webPort}`
const apiPort = Number(process.env.API_PORT || 4445)
const apiUrl = `http://127.0.0.1:${apiPort}/health`
const desktopProject = path.join(process.cwd(), "desktop-webview2", "SpeechFlow.Desktop.csproj")
const desktopExe = path.join(process.cwd(), "desktop-webview2", "bin", "Debug", "net8.0-windows", "Scripto.Desktop.exe")
const desktopAppData = path.join(process.cwd(), ".codex-appdata")
const desktopLocalAppData = path.join(process.cwd(), ".codex-localappdata")

fs.mkdirSync(desktopAppData, { recursive: true })
fs.mkdirSync(desktopLocalAppData, { recursive: true })

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
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
    if (!child.killed) child.kill()
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

function removeStaleNextLock() {
  const lockPath = path.join(process.cwd(), ".next", "dev", "lock")
  if (fs.existsSync(lockPath)) {
    fs.rmSync(lockPath, { force: true })
    console.log("Removed stale Next.js dev lock.")
  }
}

const webAlreadyRunning = await isServiceReachable(webUrl)
if (!webAlreadyRunning) {
  removeStaleNextLock()
  start("web", process.execPath, ["./scripts/frontend-server.mjs"], {
    env: {
      ...process.env,
      PORT: String(webPort),
      NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
    },
  })
} else {
  console.log(`Reusing existing frontend at ${webUrl}`)
}

const apiAlreadyRunning = await isServiceReachable(apiUrl)
if (!apiAlreadyRunning) {
  start("api", process.execPath, ["./backend/scripts/dev.mjs"], {
    env: {
      ...process.env,
      PORT: String(apiPort),
      CORS_ORIGINS: `${webUrl},${localWebUrl}`,
    },
  })
} else {
  console.log(`Reusing existing API at ${apiUrl}`)
}

const desktopBuild = spawnSync("dotnet", ["build", desktopProject, "-p:RestoreIgnoreFailedSources=true"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    APPDATA: desktopAppData,
    LOCALAPPDATA: desktopLocalAppData,
  },
})

if (desktopBuild.status !== 0) {
  shutdown(desktopBuild.status ?? 1)
}

console.log(`Starting desktop host from ${desktopExe}`)
start("desktop", desktopExe, [], {
  env: {
    ...process.env,
    APPDATA: desktopAppData,
    LOCALAPPDATA: desktopLocalAppData,
    SPEECHFLOW_WEB_URL: webUrl,
    SPEECHFLOW_API_URL: apiUrl,
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
    CORS_ORIGINS: `${webUrl},${localWebUrl}`,
  },
})

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))
