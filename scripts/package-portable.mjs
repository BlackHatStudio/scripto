/**
 * scripts/package-portable.mjs
 *
 * Creates dist-portable/Scripto v<version>/ - a self-contained Windows deployment package.
 *
 * What the bundle includes:
 *   install.exe    - Windows installer (C# .NET 8 self-contained)
 *   backend/       - Express API, compiled TypeScript, production node_modules
 *   frontend/      - Next.js standalone server (no node_modules needed)
 *   desktop/       - Self-contained .NET 8 WebView2 host (no .NET runtime needed)
 *   node/          - Bundled Node.js runtimes: node-x64.exe and node-arm64.exe
 *   Start-Scripto.ps1 / .bat  - Launcher (arch-aware, health-checked)
 *   Stop-Scripto.ps1           - Clean shutdown script
 *   INSTALL.md                 - End-user instructions
 *
 * Prerequisites (run once before packaging):
 *   npm run build
 *   dotnet publish .\desktop-webview2\SpeechFlow.Desktop.csproj -c Release -r win-x64 --self-contained true -o .\dist-portable-work\desktop
 *
 * Usage:
 *   npm run package      (or: node ./scripts/package-portable.mjs)
 *
 * Output: dist-portable/Scripto v<version>/   and   dist-portable/Scripto v<version>.zip
 */

import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, statSync, readFileSync } from "node:fs"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"

const NODE_VERSION = "v22.12.0"
const NODE_X64_URL  = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`
const NODE_ARM64_URL = `https://nodejs.org/dist/${NODE_VERSION}/win-arm64/node.exe`

const ROOT              = process.cwd()
const VERSION           = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version
const BUNDLE_NAME       = `Scripto v${VERSION}`
const WORK              = path.join(ROOT, "dist-portable-work")
const NODE_CACHE        = path.join(WORK, "node-cache")
const INSTALLER_SRC     = path.join(ROOT, "installer")
const INSTALLER_WORK    = path.join(WORK, "installer")
const DESKTOP_SRC       = path.join(WORK, "desktop")
const STANDALONE_SRC    = path.join(ROOT, ".next", "standalone")
const STATIC_SRC        = path.join(ROOT, ".next", "static")
const PUBLIC_SRC        = path.join(ROOT, "public")
const BACKEND_DIST_SRC  = path.join(ROOT, "backend", "dist")
const BACKEND_VENDOR_SRC = path.join(ROOT, "backend", "vendor", "whisper")

const OUT          = path.join(ROOT, "dist-portable", BUNDLE_NAME)
const FRONTEND_OUT = path.join(OUT, "frontend")
const BACKEND_OUT  = path.join(OUT, "backend")
const DESKTOP_OUT  = path.join(OUT, "desktop")
const NODE_OUT     = path.join(OUT, "node")

// --- Preflight checks --------------------------------------------------------

function check(cond, msg) {
  if (!cond) { console.error(`\nERROR: ${msg}\n`); process.exit(1) }
}

check(existsSync(STANDALONE_SRC), "Next.js standalone output missing - run: npm run build")
check(existsSync(BACKEND_DIST_SRC), "Backend dist missing - run: npm run build")
check(existsSync(BACKEND_VENDOR_SRC), [
  "Whisper vendor files missing (backend/vendor/whisper). Offline dictation needs the",
  "bundled whisper-cli binary + GGML model. Run: npm run fetch-whisper",
].join("\n"))
check(existsSync(DESKTOP_SRC), [
  "Desktop publish output missing. Run:",
  "  dotnet publish .\\desktop-webview2\\SpeechFlow.Desktop.csproj",
  "    -c Release -r win-x64 --self-contained true -o .\\dist-portable-work\\desktop",
].join("\n"))

// --- Clean output -------------------------------------------------------------

console.log("\n=== Cleaning output ===")
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const zipPath = path.join(ROOT, "dist-portable", `${BUNDLE_NAME}.zip`)
if (existsSync(zipPath)) rmSync(zipPath, { force: true })

// --- 1. Download Node.js runtimes --------------------------------------------

console.log("\n=== 1/8  Node.js runtimes ===")
mkdirSync(NODE_CACHE, { recursive: true })
mkdirSync(NODE_OUT, { recursive: true })

async function downloadIfNeeded(url, cachePath, destPath, label) {
  const MIN_BYTES = 50 * 1024 * 1024  // sanity check: must be > 50 MB

  if (existsSync(cachePath) && statSync(cachePath).size > MIN_BYTES) {
    console.log(`  cached:     ${label}`)
  } else {
    process.stdout.write(`  downloading ${label}...`)
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading ${url}`)
    const writer = createWriteStream(cachePath)
    await pipeline(resp.body, writer)
    const size = statSync(cachePath).size
    console.log(` ${(size / 1024 / 1024).toFixed(1)} MB`)
  }

  cpSync(cachePath, destPath)
}

const nodeX64Cache = path.join(NODE_CACHE, "node-x64.exe")
const nodeArm64Cache = path.join(NODE_CACHE, "node-arm64.exe")
await downloadIfNeeded(NODE_X64_URL, nodeX64Cache, path.join(NODE_OUT, "node-x64.exe"), "node.exe win-x64")
await downloadIfNeeded(NODE_ARM64_URL, nodeArm64Cache, path.join(NODE_OUT, "node-arm64.exe"), "node.exe win-arm64")
console.log("  node/ ready")

// --- 2. Next.js standalone frontend ------------------------------------------

console.log("\n=== 2/8  Frontend (Next.js standalone) ===")
mkdirSync(FRONTEND_OUT, { recursive: true })
cpSync(STANDALONE_SRC, FRONTEND_OUT, { recursive: true })
cpSync(STATIC_SRC, path.join(FRONTEND_OUT, ".next", "static"), { recursive: true })
if (existsSync(PUBLIC_SRC)) cpSync(PUBLIC_SRC, path.join(FRONTEND_OUT, "public"), { recursive: true })
console.log("  frontend/ ready")

// --- 3. Backend --------------------------------------------------------------

console.log("\n=== 3/8  Backend (compiled + production node_modules) ===")
mkdirSync(BACKEND_OUT, { recursive: true })
cpSync(BACKEND_DIST_SRC, path.join(BACKEND_OUT, "dist"), { recursive: true })

// Slim package.json - no Prisma, @node-rs/argon2 replaces argon2
// Both win32-x64-msvc and win32-arm64-msvc platform packages are installed below.
const backendPkg = {
  name: "scripto-backend",
  version: VERSION,
  private: true,
  dependencies: {
    "@node-rs/argon2": "^2.0.2",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^8.2.1",
    "ffmpeg-static": "^5.2.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "nanoid": "^5.1.5",
    "pg": "^8.20.0",
    "sanitize-html": "^2.17.0",
    "zod": "^3.25.67",
  },
}
writeFileSync(path.join(BACKEND_OUT, "package.json"), JSON.stringify(backendPkg, null, 2) + "\n")

// Placeholder .env - the installer overwrites this with real generated secrets
writeFileSync(path.join(BACKEND_OUT, ".env"), [
  "PORT=4445",
  "DATABASE_URL=",
  "CORS_ORIGINS=http://localhost:4444,http://127.0.0.1:4444",
  "JWT_ACCESS_SECRET=change-me-access",
  "JWT_REFRESH_SECRET=change-me-refresh",
  "DEV_EMAIL_VERIFICATION_BYPASS=true",
  "TRANSCRIPTION_PROVIDER=local-whisper",
  "NODE_ENV=production",
  "",
].join("\n"))

// Bundle the whisper.cpp binary + GGML model so dictation transcribes fully on-device with
// no internet connection. config.ts resolves these relative to cwd (backend/), which is where
// the launcher starts the process, so they must land at backend/vendor/whisper.
cpSync(BACKEND_VENDOR_SRC, path.join(BACKEND_OUT, "vendor", "whisper"), { recursive: true })
console.log("  backend/vendor/whisper (offline transcription) ready")

// Install production dependencies
console.log("  installing backend deps...")
const npmResult = spawnSync("npm", ["install", "--omit=dev", "--no-fund", "--no-audit"],
  { cwd: BACKEND_OUT, stdio: "inherit", shell: true })
if (npmResult.error) { console.error("npm spawn error:", npmResult.error); process.exit(1) }
check(npmResult.status === 0, `Backend npm install failed (exit ${npmResult.status})`)

// Force-install both Win32 arch-specific argon2 native binaries so the bundle
// works on both x64 and arm64 Windows without requiring native compilation.
// These are pure prebuilt packages - no node-gyp, no Visual Studio required.
console.log("  installing cross-arch argon2 native binaries...")
const archPkgs = [
  "@node-rs/argon2-win32-x64-msvc@2.0.2",
  "@node-rs/argon2-win32-arm64-msvc@2.0.2",
]
const archResult = spawnSync("npm",
  ["install", "--no-save", "--no-fund", "--no-audit", "--ignore-scripts", "--force", ...archPkgs],
  { cwd: BACKEND_OUT, stdio: "inherit", shell: true })
if (archResult.error) { console.error("npm arch install error:", archResult.error); process.exit(1) }
check(archResult.status === 0, `Argon2 cross-arch install failed (exit ${archResult.status})`)
console.log("  backend/ ready")

// --- 4. Desktop host ---------------------------------------------------------

console.log("\n=== 4/8  Desktop host (self-contained .NET 8 WebView2) ===")
cpSync(DESKTOP_SRC, DESKTOP_OUT, { recursive: true })
console.log("  desktop/ ready")

// --- 5. Build installer ------------------------------------------------------

console.log("\n=== 5/8  Building installer (install.exe) ===")
mkdirSync(INSTALLER_WORK, { recursive: true })
// Always a full (re)build - "dotnet publish --no-build" silently reuses stale
// output even when Program.cs has changed, which previously shipped a stale installer.
const publishResult = spawnSync("dotnet", [
  "publish", path.join(INSTALLER_SRC, "ScriptoInstaller.csproj"),
  "-c", "Release",
  "-r", "win-x64",
  "--self-contained", "true",
  "-o", INSTALLER_WORK,
  "/p:PublishSingleFile=true",
  "--nologo",
], { cwd: ROOT, stdio: "inherit", shell: false })
check(publishResult.status === 0, `Installer publish failed (exit ${publishResult.status})`)
const installerExe = path.join(INSTALLER_WORK, "install.exe")
check(existsSync(installerExe), `Installer build failed - install.exe not found at ${installerExe}`)
cpSync(installerExe, path.join(OUT, "install.exe"))
console.log(`  install.exe ready (${(statSync(installerExe).size / 1024 / 1024).toFixed(1)} MB)`)

// --- 6. Launcher scripts -----------------------------------------------------

console.log("\n=== 6/8  Launcher and helper scripts ===")

// Start-Scripto.ps1 - arch-aware, process-tracking, health-gated launch
writeFileSync(path.join(OUT, "Start-Scripto.ps1"), [
  "# Scripto launcher - arch-aware, production-safe",
  "# Do not edit PORT/HOSTNAME here; edit backend\\.env for secrets.",
  "param()",
  '$ErrorActionPreference = "Stop"',
  "",
  '$root       = Split-Path $MyInvocation.MyCommand.Path -Resolve',
  '$logDir     = "$root\\logs"',
  '$pidBackend  = "$root\\scripto-backend.pid"',
  '$pidFrontend = "$root\\scripto-frontend.pid"',
  '$pidDesktop  = "$root\\scripto-desktop.pid"',
  "",
  "# -- Detect arch and pick bundled node runtime ------------------------------",
  'if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {',
  '    $node = "$root\\node\\node-arm64.exe"',
  "} else {",
  '    $node = "$root\\node\\node-x64.exe"',
  "}",
  'if (-not (Test-Path $node)) {',
  '    Write-Error "Bundled Node.js runtime not found at: $node"',
  "    exit 1",
  "}",
  "",
  "# -- Check if Scripto is already running (via PID files) --------------------",
  "function Test-ScriptoPid($pidFile) {",
  "    if (-not (Test-Path $pidFile)) { return $false }",
  "    try {",
  "        $id = [int](Get-Content $pidFile -Raw).Trim()",
  "        $proc = Get-Process -Id $id -ErrorAction Stop",
  "        return $null -ne $proc",
  "    } catch { return $false }",
  "}",
  "",
  "if ((Test-ScriptoPid $pidBackend) -and (Test-ScriptoPid $pidFrontend)) {",
  "    if (Test-ScriptoPid $pidDesktop) {",
  '        Write-Host "Scripto is already running (desktop UI is already open)." -ForegroundColor Cyan',
  "        exit 0",
  "    }",
  '    Write-Host "Scripto is already running. Launching desktop UI..." -ForegroundColor Cyan',
  '    $env:SPEECHFLOW_WEB_URL = "http://127.0.0.1:4444"',
  '    $env:SPEECHFLOW_API_URL = "http://127.0.0.1:4445/health"',
  '    $desktopProc = Start-Process -FilePath "$root\\desktop\\Scripto.Desktop.exe" -PassThru',
  "    $desktopProc.Id | Out-File $pidDesktop -Encoding ASCII",
  "    exit 0",
  "}",
  "",
  "# -- Port conflict check ----------------------------------------------------",
  "function Test-PortFree($port) {",
  "    try {",
  "        $props = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()",
  "        $listeners = $props.GetActiveTcpListeners()",
  "        return -not ($listeners | Where-Object { $_.Port -eq $port })",
  "    } catch { return $true }",
  "}",
  "",
  "if (-not (Test-PortFree 4445)) {",
  '    Write-Warning "Port 4445 (backend) is already in use by another process."',
  '    Write-Warning "Stop the conflicting process or reboot, then try again."',
  "    exit 1",
  "}",
  "if (-not (Test-PortFree 4444)) {",
  '    Write-Warning "Port 4444 (frontend) is already in use by another process."',
  '    Write-Warning "Stop the conflicting process or reboot, then try again."',
  "    exit 1",
  "}",
  "",
  "# -- Ensure logs directory --------------------------------------------------",
  'New-Item -ItemType Directory -Path $logDir -Force | Out-Null',
  "",
  'Write-Host "Scripto starting..." -ForegroundColor Cyan',
  "",
  "# -- Backend ----------------------------------------------------------------",
  "# JWT secrets and other config are loaded from backend\\.env via dotenv.",
  '# backend\\.env is written with real secrets by install.exe; placeholder values',
  "# are used in the portable (no-installer) case.",
  '$env:NODE_ENV = "production"',
  '$env:PORT     = "4445"',
  "",
  '$backendArgs = @{',
  '    FilePath              = $node',
  '    ArgumentList          = "`"$root\\backend\\dist\\src\\index.js`""',
  '    WorkingDirectory      = "$root\\backend"',
  '    WindowStyle           = "Hidden"',
  '    PassThru              = $true',
  '    RedirectStandardOutput = "$logDir\\backend.log"',
  '    RedirectStandardError  = "$logDir\\backend-err.log"',
  "}",
  '$backend = Start-Process @backendArgs',
  '$backend.Id | Out-File $pidBackend -Encoding ASCII',
  'Write-Host "  Backend  started (PID $($backend.Id))" -ForegroundColor DarkGray',
  "",
  "# -- Frontend ---------------------------------------------------------------",
  "# Next.js derives the API URL from window.location.hostname at runtime;",
  "# no NEXT_PUBLIC_API_BASE_URL is required for normal WebView2 operation.",
  '$env:PORT     = "4444"',
  '$env:HOSTNAME = "127.0.0.1"',
  '$env:NODE_ENV = "production"',
  "",
  '$frontendArgs = @{',
  '    FilePath              = $node',
  '    ArgumentList          = "`"$root\\frontend\\server.js`""',
  '    WorkingDirectory      = "$root\\frontend"',
  '    WindowStyle           = "Hidden"',
  '    PassThru              = $true',
  '    RedirectStandardOutput = "$logDir\\frontend.log"',
  '    RedirectStandardError  = "$logDir\\frontend-err.log"',
  "}",
  '$frontend = Start-Process @frontendArgs',
  '$frontend.Id | Out-File $pidFrontend -Encoding ASCII',
  'Write-Host "  Frontend started (PID $($frontend.Id))" -ForegroundColor DarkGray',
  "",
  "# -- Wait for backend health ------------------------------------------------",
  'Write-Host "  Waiting for backend (up to 30s)..." -ForegroundColor Yellow',
  "$maxWait = 30",
  "$elapsed  = 0",
  "$ready    = $false",
  "while ($elapsed -lt $maxWait) {",
  "    Start-Sleep -Seconds 1",
  "    $elapsed++",
  "    try {",
  '        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4445/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop',
  "        if ($r.StatusCode -eq 200) { $ready = $true; break }",
  "    } catch {}",
  "}",
  "",
  "if (-not $ready) {",
  '    Write-Host ""',
  '    Write-Host "ERROR: Backend did not become healthy after ${maxWait}s." -ForegroundColor Red',
  '    Write-Host ""',
  '    Write-Host "  Check these logs for the root cause:" -ForegroundColor Yellow',
  '    Write-Host "    $logDir\\backend-err.log" -ForegroundColor Yellow',
  '    Write-Host "    $logDir\\frontend-err.log" -ForegroundColor Yellow',
  '    Write-Host ""',
  '    Write-Host "  Common causes:" -ForegroundColor Yellow',
  '    Write-Host "    - Native module mismatch: run install.exe to reinstall" -ForegroundColor Yellow',
  '    Write-Host "    - Port 4445 blocked by antivirus/firewall" -ForegroundColor Yellow',
  '    Write-Host "    - Corrupted node_modules: run install.exe to repair" -ForegroundColor Yellow',
  "    exit 1",
  "}",
  "",
  "# -- Launch desktop (only after backend is confirmed healthy) ---------------",
  '$env:SPEECHFLOW_WEB_URL = "http://127.0.0.1:4444"',
  '$env:SPEECHFLOW_API_URL = "http://127.0.0.1:4445/health"',
  'Write-Host "  Desktop  launching..." -ForegroundColor DarkGray',
  '$desktop = Start-Process -FilePath "$root\\desktop\\Scripto.Desktop.exe" -PassThru',
  '$desktop.Id | Out-File $pidDesktop -Encoding ASCII',
  "",
  'Write-Host ""',
  'Write-Host "Scripto is running!" -ForegroundColor Green',
  'Write-Host "  Hold Ctrl+Fn (or Ctrl+Alt) to start dictating." -ForegroundColor Green',
  'Write-Host "  Right-click the system tray icon for settings." -ForegroundColor Green',
  'Write-Host "  Logs: $logDir" -ForegroundColor DarkGray',
].join("\r\n") + "\r\n")

// Stop-Scripto.ps1
writeFileSync(path.join(OUT, "Stop-Scripto.ps1"), [
  "# Scripto shutdown - stops backend, frontend, and desktop UI processes",
  "param()",
  '$root       = Split-Path $MyInvocation.MyCommand.Path -Resolve',
  '$pidBackend  = "$root\\scripto-backend.pid"',
  '$pidFrontend = "$root\\scripto-frontend.pid"',
  '$pidDesktop  = "$root\\scripto-desktop.pid"',
  "",
  "function Stop-ScriptoPid($pidFile, $label) {",
  "    if (-not (Test-Path $pidFile)) { Write-Host \"  $label not running\"; return }",
  "    try {",
  "        $id = [int](Get-Content $pidFile -Raw).Trim()",
  "        $proc = Get-Process -Id $id -ErrorAction SilentlyContinue",
  "        if (-not $proc) {",
  '            Write-Host "  $label already stopped (PID $id)"',
  "            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue",
  "            return",
  "        }",
  "        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue",
  "        $waited = 0",
  "        while ((Get-Process -Id $id -ErrorAction SilentlyContinue) -and $waited -lt 5000) {",
  "            Start-Sleep -Milliseconds 200",
  "            $waited += 200",
  "        }",
  "        if (Get-Process -Id $id -ErrorAction SilentlyContinue) {",
  '            Write-Host "  ${label}: FAILED to stop (PID $id still running after 5s)" -ForegroundColor Red',
  "        } else {",
  "            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue",
  '            Write-Host "  $label stopped (PID $id)"',
  "        }",
  "    } catch {",
  '        Write-Host "  ${label}: not found or already stopped"',
  "        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue",
  "    }",
  "}",
  "",
  'Write-Host "Stopping Scripto..." -ForegroundColor Cyan',
  "Stop-ScriptoPid $pidDesktop  'Desktop '",
  "Stop-ScriptoPid $pidBackend  'Backend '",
  "Stop-ScriptoPid $pidFrontend 'Frontend'",
  'Write-Host "Done." -ForegroundColor Green',
].join("\r\n") + "\r\n")

// Start-Scripto.bat
writeFileSync(path.join(OUT, "Start-Scripto.bat"),
  "@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0Start-Scripto.ps1\"\r\n")

// Stop-Scripto.bat
writeFileSync(path.join(OUT, "Stop-Scripto.bat"),
  "@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0Stop-Scripto.ps1\"\r\npause\r\n")

console.log("  launcher scripts written")

// --- 7. INSTALL.md -----------------------------------------------------------

console.log("\n=== 7/8  INSTALL.md ===")
writeFileSync(path.join(OUT, "INSTALL.md"), [
  `# ${BUNDLE_NAME} - Installation Guide`,
  "",
  "## Quick Start",
  "",
  `1. Extract **${BUNDLE_NAME}.zip** to any folder (e.g. \`C:\\Downloads\\${BUNDLE_NAME}\\\`)`,
  "2. Double-click **install.exe**",
  "3. Follow the prompts - no admin required, no internet needed for install",
  "4. After install completes, launch from **Start Menu → Scripto → Scripto**",
  "5. Press and hold **Ctrl+Fn** (or Ctrl+Alt) to start dictating",
  "",
  "---",
  "",
  "## What install.exe does",
  "",
  "- Copies Scripto to `%LOCALAPPDATA%\\Scripto\\` (your user folder, no admin needed)",
  "- Generates unique JWT security secrets for your install",
  "- Creates a Start Menu shortcut",
  "- Registers Scripto in Programs & Features (for easy uninstall)",
  "- Offers to create a Desktop shortcut",
  "",
  "## Prerequisites",
  "",
  "| Component | Required | Notes |",
  "|---|---|---|",
  "| Windows 10 (21H2+) or Windows 11 | Yes | x64 or ARM64 |",
  "| Microsoft WebView2 Runtime | Yes | Usually pre-installed via Edge |",
  "| Node.js | **No** | Bundled inside the package |",
  "| .NET Runtime | **No** | Desktop host is self-contained |",
  "| Internet | Yes (for dictation) | Web Speech API is cloud-backed |",
  "| Microphone | Yes (for dictation) | Any Windows audio input |",
  "",
  "If the desktop app fails to open, install the WebView2 Runtime:",
  "https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
  "",
  "## How to use Scripto",
  "",
  "After the app starts (system tray icon appears):",
  "",
  "1. Open the management window by double-clicking the tray icon",
  "2. Sign up for a local account (all data stays on your machine)",
  "3. Open any app where you want to dictate (Notepad, Word, browser, etc.)",
  "4. **Hold Ctrl+Fn** (or Ctrl+Alt) - the Listening popup appears. Fn support",
  "   depends on your keyboard; Ctrl+Alt always works as a fallback.",
  "5. Speak your dictation",
  "6. **Release the keys** - transcription stops, corrected text is pasted",
  "",
  "On first use, WebView2 will prompt for microphone permission - click **Allow**.",
  "",
  "## How to start Scripto",
  "",
  "Option 1 (recommended): Start Menu → Scripto → Scripto",
  "",
  "Option 2: Open `%LOCALAPPDATA%\\Scripto\\` and double-click **Start-Scripto.bat**",
  "",
  "## How to stop Scripto",
  "",
  "Right-click the system tray icon → **Quit**.",
  "",
  "To also stop the background Node processes:",
  "- Double-click **Stop-Scripto.bat** in the install folder",
  "- Or run `Stop-Scripto.ps1` from PowerShell",
  "",
  "## How to verify backend health",
  "",
  "Open PowerShell and run:",
  "",
  "    Invoke-WebRequest http://127.0.0.1:4445/health -UseBasicParsing | Select-Object StatusCode",
  "",
  "Expected: `StatusCode : 200`",
  "",
  "## Troubleshooting",
  "",
  "### Backend failed to start (health check failed)",
  "",
  "Check the log files:",
  "",
  "    %LOCALAPPDATA%\\Scripto\\logs\\backend-err.log",
  "    %LOCALAPPDATA%\\Scripto\\logs\\frontend-err.log",
  "",
  "Common fixes:",
  "- **Native module error**: Re-run `install.exe` to repair the installation",
  "- **Port in use**: Another app is using port 4444 or 4445; identify it with",
  "  `netstat -ano | findstr :4445` and stop it",
  "- **Firewall blocking localhost**: Temporarily disable and retry",
  "",
  "### Desktop tray icon not visible",
  "",
  "The icon may be hidden in the overflow tray. Click the ^ arrow in the taskbar",
  "corner to show hidden icons.",
  "",
  "### Microphone permission denied",
  "",
  "WebView2 inherits Edge's microphone permission. Open Edge → Settings →",
  "Privacy → Site Permissions → Microphone → Allow sites to ask.",
  "",
  "### Antivirus / SmartScreen warning",
  "",
  "Scripto is unsigned for V1. If SmartScreen blocks it:",
  "- Right-click `install.exe` → Properties → Unblock → OK",
  "- Or click 'More info' → 'Run anyway' in the SmartScreen dialog",
  "",
  "### Reinstall / repair",
  "",
  "Re-run `install.exe` from the original extracted Scripto folder.",
  "Your user data and secrets are preserved on reinstall.",
  "",
  "## Uninstall",
  "",
  "1. Settings → Apps → Scripto → Uninstall",
  "   OR",
  "   Run `install.exe --uninstall` from the install folder",
  "",
  "Your dictation history (`.local-pg\\`) is preserved after uninstall.",
  "To remove it completely, delete `%LOCALAPPDATA%\\Scripto\\.local-pg\\`",
  "",
  "## Security notes",
  "",
  "- All data stays on your local machine - nothing is sent to any cloud",
  "  (except the speech audio itself, which goes to the browser Web Speech API)",
  "- JWT secrets are randomly generated per install and stored in `backend\\.env`",
  "- The API server binds to 127.0.0.1 only - not accessible from other machines",
  "- Logs are written to `%LOCALAPPDATA%\\Scripto\\logs\\`",
  "",
  "## Log file locations",
  "",
  "| File | Contents |",
  "|---|---|",
  "| `logs\\backend.log` | Express API startup and request log |",
  "| `logs\\backend-err.log` | Backend errors (check this on startup failure) |",
  "| `logs\\frontend.log` | Next.js server log |",
  "| `logs\\frontend-err.log` | Frontend errors |",
  "| `.local-pg\\speechflow-state.json` | Local user data store |",
  "",
].join("\n"))
console.log("  INSTALL.md written")

// --- Done --------------------------------------------------------------------

// --- 8. Zip -------------------------------------------------------------------

console.log("\n=== 8/8  Creating zip ===")
const zipResult = spawnSync("powershell",
  ["-NoProfile", "-Command", `Compress-Archive -Path "${OUT}" -DestinationPath "${zipPath}" -Force`],
  { stdio: "inherit", shell: false })
check(zipResult.status === 0 && existsSync(zipPath), "Zip creation failed")
console.log(`  ${path.basename(zipPath)} ready (${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB)`)

// --- Done --------------------------------------------------------------------

console.log("\n=== Portable bundle complete ===")
console.log(`\n  Output: ${OUT}`)
console.log(`  Zip:    ${zipPath}`)
console.log("\n  To validate the bundle:")
console.log(`  powershell -ExecutionPolicy Bypass -File scripts\\validate-deploy.ps1 -BundlePath "${OUT}"`)
