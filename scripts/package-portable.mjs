/**
 * scripts/package-portable.mjs
 *
 * Creates dist-portable/Scripto/ — a portable folder + zip that requires only:
 *   1. Node.js >= 20.9  (nodejs.org)
 *   2. Microsoft WebView2 Runtime  (usually pre-installed on Windows 10/11 via Edge)
 *
 * What it bundles (all built beforehand by "npm run build" and "dotnet publish"):
 *   frontend/   — .next/standalone self-contained Next.js server (no node_modules needed)
 *   backend/    — compiled Express API with production-only node_modules
 *   desktop/    — self-contained .NET 8 WebView2 exe (no .NET runtime needed)
 *   Start-Scripto.bat / Start-Scripto.ps1 — one-click launcher
 *   INSTALL.md  — end-user instructions
 *
 * Usage:
 *   npm run build          # builds Next + backend TypeScript
 *   node ./scripts/package-portable.mjs
 *
 * Output: dist-portable/Scripto/   and   dist-portable/Scripto.zip
 */

import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const WORK = path.join(ROOT, "dist-portable-work")
const OUT = path.join(ROOT, "dist-portable", "Scripto")
const FRONTEND_OUT = path.join(OUT, "frontend")
const BACKEND_OUT = path.join(OUT, "backend")
const DESKTOP_OUT = path.join(OUT, "desktop")

const DESKTOP_PUBLISH_SRC = path.join(WORK, "desktop")
const STANDALONE_SRC = path.join(ROOT, ".next", "standalone")
const STATIC_SRC = path.join(ROOT, ".next", "static")
const PUBLIC_SRC = path.join(ROOT, "public")
const BACKEND_DIST_SRC = path.join(ROOT, "backend", "dist")

// ─── preflight checks ───────────────────────────────────────────────────────

function check(condition, message) {
  if (!condition) {
    console.error(`ERROR: ${message}`)
    process.exit(1)
  }
}

check(existsSync(STANDALONE_SRC), "Next standalone output missing — run: npm run build")
check(existsSync(BACKEND_DIST_SRC), "Backend dist missing — run: npm run build")
check(existsSync(DESKTOP_PUBLISH_SRC), [
  "Desktop publish output missing.",
  "Run: dotnet publish .\\desktop-webview2\\SpeechFlow.Desktop.csproj -c Release -r win-x64 --self-contained true -o .\\dist-portable-work\\desktop",
].join(" "))

// ─── clean output ────────────────────────────────────────────────────────────

console.log("\n=== Cleaning output directory ===")
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
if (existsSync(path.join(ROOT, "dist-portable", "Scripto.zip"))) {
  rmSync(path.join(ROOT, "dist-portable", "Scripto.zip"), { force: true })
}

// ─── 1. Next.js standalone frontend ─────────────────────────────────────────

console.log("\n=== 1/5  Next.js standalone frontend ===")
mkdirSync(FRONTEND_OUT, { recursive: true })

// standalone/ contains server.js + node_modules/ — copy as-is
cpSync(STANDALONE_SRC, FRONTEND_OUT, { recursive: true })

// static assets must live at <server root>/.next/static/
cpSync(STATIC_SRC, path.join(FRONTEND_OUT, ".next", "static"), { recursive: true })

// public/ assets must live at <server root>/public/
if (existsSync(PUBLIC_SRC)) {
  cpSync(PUBLIC_SRC, path.join(FRONTEND_OUT, "public"), { recursive: true })
}
console.log("  frontend/ ready")

// ─── 2. Backend ──────────────────────────────────────────────────────────────

console.log("\n=== 2/5  Backend (compiled + production node_modules) ===")
mkdirSync(BACKEND_OUT, { recursive: true })

// Copy compiled TypeScript output
cpSync(BACKEND_DIST_SRC, path.join(BACKEND_OUT, "dist"), { recursive: true })

// Create a slim package.json for the backend that excludes Prisma/devDeps.
// @prisma/client is declared but never imported in the backend source; omitting it
// avoids the prisma generate step and shrinks the bundle.
const backendPackage = {
  name: "scripto-backend",
  version: "1.0.0",
  private: true,
  dependencies: {
    "argon2": "^0.43.0",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^8.2.1",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "nanoid": "^5.1.5",
    "pg": "^8.20.0",
    "sanitize-html": "^2.17.0",
    "zod": "^3.25.67",
  },
}
writeFileSync(
  path.join(BACKEND_OUT, "package.json"),
  JSON.stringify(backendPackage, null, 2) + "\n",
)

// Write backend .env template
writeFileSync(
  path.join(BACKEND_OUT, ".env"),
  [
    "PORT=4445",
    "DATABASE_URL=",
    "CORS_ORIGINS=http://localhost:4444,http://127.0.0.1:4444",
    "JWT_ACCESS_SECRET=change-me-access",
    "JWT_REFRESH_SECRET=change-me-refresh",
    "DEV_EMAIL_VERIFICATION_BYPASS=true",
    "TRANSCRIPTION_PROVIDER=mock",
    "",
  ].join("\n"),
)

console.log("  Installing backend production dependencies (this may take a minute)...")
const npmResult = spawnSync(
  "npm",
  ["install", "--omit=dev", "--no-fund", "--no-audit"],
  { cwd: BACKEND_OUT, stdio: "inherit", shell: true },
)
if (npmResult.error) {
  console.error("npm spawn error:", npmResult.error)
  process.exit(1)
}
check(npmResult.status === 0, `Backend npm install failed (exit ${npmResult.status})`)
console.log("  backend/ ready")

// ─── 3. Desktop host ─────────────────────────────────────────────────────────

console.log("\n=== 3/5  Desktop host (self-contained .NET 8 WebView2) ===")
cpSync(DESKTOP_PUBLISH_SRC, DESKTOP_OUT, { recursive: true })
console.log("  desktop/ ready")

// ─── 4. Launcher scripts ─────────────────────────────────────────────────────

console.log("\n=== 4/5  Launcher scripts ===")

// PowerShell launcher (primary)
const ps1Content = [
  "# Scripto portable launcher",
  "# Run with:  powershell -ExecutionPolicy Bypass -File Start-Scripto.ps1",
  "# Or double-click Start-Scripto.bat which calls this script.",
  "",
  "param()",
  '$ErrorActionPreference = "Stop"',
  "",
  '$root    = Split-Path $MyInvocation.MyCommand.Path -Resolve',
  '$node    = "node"',
  '$apiPort = 4445',
  '$webPort = 4444',
  '$webUrl  = "http://127.0.0.1:$webPort"',
  '$apiUrl  = "http://127.0.0.1:$apiPort"',
  "",
  "# Verify node is available",
  'if (-not (Get-Command $node -ErrorAction SilentlyContinue)) {',
  '    Write-Error "Node.js not found on PATH. Install Node.js >= 20.9 from https://nodejs.org"',
  "    exit 1",
  "}",
  "",
  'Write-Host "Scripto starting..." -ForegroundColor Cyan',
  "",
  "# -- backend -----------------------------------------------------------------",
  '$env:PORT                          = $apiPort',
  '$env:CORS_ORIGINS                  = "http://localhost:$webPort,http://127.0.0.1:$webPort"',
  '$env:JWT_ACCESS_SECRET             = "change-me-access"',
  '$env:JWT_REFRESH_SECRET            = "change-me-refresh"',
  '$env:DEV_EMAIL_VERIFICATION_BYPASS = "true"',
  '$env:TRANSCRIPTION_PROVIDER        = "mock"',
  '$env:NODE_ENV                      = "production"',
  "",
  '$backendArgs = @{ FilePath = $node; ArgumentList = "$root\\backend\\dist\\src\\index.js"; WorkingDirectory = "$root\\backend"; WindowStyle = "Hidden"; PassThru = $true; RedirectStandardOutput = "$root\\backend.log"; RedirectStandardError = "$root\\backend-err.log" }',
  '$backend = Start-Process @backendArgs',
  'Write-Host "  Backend started  (PID $($backend.Id))" -ForegroundColor DarkGray',
  "",
  "# -- frontend ----------------------------------------------------------------",
  '$env:PORT                     = $webPort',
  '$env:HOSTNAME                 = "127.0.0.1"',
  '$env:NODE_ENV                 = "production"',
  '$env:NEXT_PUBLIC_API_BASE_URL = "$apiUrl/api"',
  "",
  '$frontendArgs = @{ FilePath = $node; ArgumentList = "$root\\frontend\\server.js"; WorkingDirectory = "$root\\frontend"; WindowStyle = "Hidden"; PassThru = $true; RedirectStandardOutput = "$root\\frontend.log"; RedirectStandardError = "$root\\frontend-err.log" }',
  '$frontend = Start-Process @frontendArgs',
  'Write-Host "  Frontend started (PID $($frontend.Id))" -ForegroundColor DarkGray',
  "",
  "# -- wait for services -------------------------------------------------------",
  'Write-Host "  Waiting for services (up to 30s)..." -ForegroundColor Yellow',
  '$maxWait = 30',
  '$elapsed  = 0',
  '$ready    = $false',
  'while ($elapsed -lt $maxWait) {',
  "    Start-Sleep -Seconds 1",
  "    $elapsed++",
  "    try {",
  '        $r = Invoke-WebRequest -Uri "$apiUrl/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop',
  '        if ($r.StatusCode -eq 200) { $ready = $true; break }',
  "    } catch {}",
  "}",
  "",
  'if (-not $ready) {',
  '    Write-Warning "Backend did not respond after ${maxWait}s. Check backend.log for errors."',
  "}",
  "",
  "# -- desktop host ------------------------------------------------------------",
  '$env:SPEECHFLOW_WEB_URL = $webUrl',
  '$env:SPEECHFLOW_API_URL = "$apiUrl/health"',
  "",
  'Write-Host "  Launching desktop..." -ForegroundColor DarkGray',
  'Start-Process -FilePath "$root\\desktop\\Scripto.Desktop.exe"',
  'Write-Host "Scripto is running. Use Ctrl+Win (hold) or Ctrl+Alt (hold) to dictate." -ForegroundColor Green',
  'Write-Host "Check the system tray to access the management window." -ForegroundColor Green',
].join("\n") + "\n"

writeFileSync(path.join(OUT, "Start-Scripto.ps1"), ps1Content)

// Batch wrapper (double-click friendly)
writeFileSync(
  path.join(OUT, "Start-Scripto.bat"),
  `@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Scripto.ps1"
`,
)

console.log("  launcher scripts written")

// ─── 5. INSTALL.md ───────────────────────────────────────────────────────────

console.log("\n=== 5/5  INSTALL.md ===")
const installMd = [
  "# Scripto — Install and Run Guide",
  "",
  "## Prerequisites",
  "",
  "Before running Scripto, install these two things (both are free):",
  "",
  "1. **Node.js >= 20.9** — https://nodejs.org/en/download",
  "   Choose the Windows Installer (.msi), LTS version.",
  "   After install, open a new Command Prompt and verify: `node --version`",
  "",
  "2. **Microsoft WebView2 Runtime** — https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
  "   Most Windows 10 (21H2+) and all Windows 11 machines already have this via Microsoft Edge.",
  '   If the desktop app fails to open, install the "Evergreen Bootstrapper" from that page.',
  "",
  "## First-time setup",
  "",
  "1. Unzip **Scripto.zip** to a folder of your choice (e.g. `C:\\Scripto\\`)",
  '2. Double-click **Start-Scripto.bat** (or right-click → "Run with PowerShell")',
  "3. A system tray icon (bottom-right) will appear after ~15 seconds",
  "4. Double-click the tray icon to open the management window",
  "5. Sign up for an account or log in",
  "",
  "## Using dictation",
  "",
  "After logging in, press and **hold Ctrl + Win** (or Ctrl + Alt).",
  "",
  "- The \"Listening\" popup appears while you hold the keys",
  "- Speak your dictation",
  "- **Release the keys** to stop recording",
  "- Corrected text is automatically pasted into the active window",
  "",
  "Your browser and microphone must allow audio capture. On first use, WebView2 will prompt",
  "for microphone permission — click Allow.",
  "",
  "## Requirements",
  "",
  "- Internet connection (required for speech recognition via the browser Web Speech API)",
  "- A working microphone",
  "- Windows 10 (21H2+) or Windows 11",
  "",
  "## Known limitations",
  "",
  "- Speech recognition is cloud-based (Google via browser Web Speech API); internet is required",
  "- The app must be started manually; Windows auto-start is not yet configured",
  "- After a reboot, double-click Start-Scripto.bat again",
  '- The installer is unsigned; Windows may show a SmartScreen warning — click "More info" then "Run anyway"',
  "",
  "## Log files",
  "",
  "If something goes wrong, check these log files inside the Scripto folder:",
  "",
  "- `backend.log` / `backend-err.log` — API server output",
  "- `frontend.log` / `frontend-err.log` — UI server output",
  "",
  "## Changing secrets",
  "",
  "The default JWT secrets in `Start-Scripto.ps1` are placeholders. For a shared or",
  "production deployment, open `Start-Scripto.ps1` in a text editor and set:",
  "",
  '    $env:JWT_ACCESS_SECRET  = "your-strong-random-secret"',
  '    $env:JWT_REFRESH_SECRET = "another-strong-random-secret"',
  "",
  "Never share these values.",
  "",
  "## Quitting",
  "",
  "Right-click the tray icon → **Quit**.",
  "The backend and frontend Node processes will be orphaned and continue running until you",
  "close them. To stop everything cleanly, close each from Task Manager, or reboot.",
  "",
  "> A future update will add a proper shutdown sequence from the tray.",
  "",
].join("\n")

writeFileSync(path.join(OUT, "INSTALL.md"), installMd)

console.log("  INSTALL.md written")

// ─── done ─────────────────────────────────────────────────────────────────────

console.log("\n=== Portable bundle complete ===")
console.log(`  Output: ${OUT}`)
console.log()
console.log("To verify, run from the output folder:")
console.log("  powershell -ExecutionPolicy Bypass -File Start-Scripto.ps1")
console.log()
console.log("To create a zip, run:")
console.log("  Compress-Archive -Path dist-portable\\Scripto -DestinationPath dist-portable\\Scripto.zip")
