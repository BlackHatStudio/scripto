# scripts/validate-deploy.ps1
#
# Validates the Scripto portable bundle produced by "npm run package".
# Checks file integrity, starts services, validates health endpoints, then stops.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\validate-deploy.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\validate-deploy.ps1 -BundlePath "C:\some\path\Scripto"
#   powershell -ExecutionPolicy Bypass -File scripts\validate-deploy.ps1 -SkipStartup

param(
    [string]$BundlePath = "",
    [switch]$SkipStartup
)

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0

# Resolve bundle path - bundles are versioned as "Scripto v<version>"; default to
# the most recently built one unless -BundlePath is given explicitly.
if ($BundlePath -eq "") {
    $distPortable = Join-Path $PSScriptRoot "..\dist-portable"
    $candidate = Get-ChildItem -Path $distPortable -Directory -Filter "Scripto v*" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($candidate) { $BundlePath = $candidate.FullName }
}
$resolved = Resolve-Path $BundlePath -ErrorAction SilentlyContinue
if (-not $resolved) {
    Write-Host "ERROR: Bundle not found. Run 'npm run package' first." -ForegroundColor Red
    exit 1
}
$BundlePath = $resolved.Path

Write-Host ""
Write-Host "Scripto Deploy Validation" -ForegroundColor Cyan
Write-Host "  Bundle: $BundlePath"
Write-Host "  Date:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

function Ok($label) {
    Write-Host "  [PASS] $label" -ForegroundColor Green
    $script:pass++
}
function Fail($label, $detail = "") {
    if ($detail) {
        Write-Host "  [FAIL] $label - $detail" -ForegroundColor Red
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
    }
    $script:fail++
}
function Skip($label, $reason = "") {
    Write-Host "  [SKIP] $label" -ForegroundColor Yellow
}

# --- File integrity checks ---------------------------------------------------

Write-Host "-- File integrity -----------------------------------------------" -ForegroundColor DarkGray

$checks = @(
    @{ Path = "install.exe";                   Label = "install.exe (installer)" },
    @{ Path = "Start-Scripto.ps1";             Label = "Start-Scripto.ps1 (launcher)" },
    @{ Path = "Stop-Scripto.ps1";              Label = "Stop-Scripto.ps1 (shutdown)" },
    @{ Path = "Start-Scripto.bat";             Label = "Start-Scripto.bat (bat wrapper)" },
    @{ Path = "INSTALL.md";                    Label = "INSTALL.md (user docs)" },
    @{ Path = "backend\dist\src\index.js";     Label = "backend entry point" },
    @{ Path = "backend\node_modules";          Label = "backend node_modules" },
    @{ Path = "backend\.env";                  Label = "backend .env (config)" },
    @{ Path = "frontend\server.js";            Label = "frontend Next.js standalone server" },
    @{ Path = "frontend\.next\static";         Label = "frontend static assets" },
    @{ Path = "desktop\Scripto.Desktop.exe";   Label = "desktop WebView2 host exe" },
    @{ Path = "desktop\WebView2Loader.dll";    Label = "desktop WebView2Loader.dll (native dependency)" },
    @{ Path = "node\node-x64.exe";             Label = "bundled Node.js x64 runtime" },
    @{ Path = "node\node-arm64.exe";           Label = "bundled Node.js ARM64 runtime" }
)

foreach ($c in $checks) {
    $full = Join-Path $BundlePath $c.Path
    if (Test-Path $full) { Ok $c.Label } else { Fail $c.Label "not found at $full" }
}

# Verify @node-rs/argon2 is present (not the old argon2)
$argon2Path = Join-Path $BundlePath "backend\node_modules\@node-rs\argon2"
$oldArgon2   = Join-Path $BundlePath "backend\node_modules\argon2"
if (Test-Path $argon2Path) { Ok "@node-rs/argon2 installed (no native compilation needed)" } else { Fail "@node-rs/argon2 missing" }
if (Test-Path $oldArgon2)  { Fail "old argon2 package present (should have been replaced)" } else { Ok "old argon2 package absent" }

# Verify both arch-specific argon2 natives
$x64Native   = Join-Path $BundlePath "backend\node_modules\@node-rs\argon2-win32-x64-msvc"
$arm64Native = Join-Path $BundlePath "backend\node_modules\@node-rs\argon2-win32-arm64-msvc"
if (Test-Path $x64Native)   { Ok "argon2 native x64 binary present" }   else { Fail "argon2 x64 binary missing" }
if (Test-Path $arm64Native) { Ok "argon2 native ARM64 binary present" } else { Fail "argon2 ARM64 binary missing" }

# Verify no Prisma client (would require prisma generate at runtime)
$prismaClient = Join-Path $BundlePath "backend\node_modules\@prisma\client"
if (-not (Test-Path $prismaClient)) { Ok "Prisma client absent (no generate step needed)" } else { Fail "Prisma client present - should be excluded from bundle" }

# Verify placeholder secrets not hardcoded in launcher (should be in .env, not in .ps1)
$ps1Content = Get-Content (Join-Path $BundlePath "Start-Scripto.ps1") -Raw
if ($ps1Content -notmatch "JWT_ACCESS_SECRET") { Ok "Launcher does not embed JWT secrets (read from backend\\.env)" } else { Fail "Launcher embeds JWT secrets - move to backend\\.env" }

# --- Size sanity -------------------------------------------------------------

Write-Host ""
Write-Host "-- Size checks --------------------------------------------------" -ForegroundColor DarkGray

function Get-DirSize($p) {
    if (-not (Test-Path $p)) { return 0 }
    (Get-ChildItem $p -Recurse -File | Measure-Object -Property Length -Sum).Sum
}

$nodeX64Item = Get-Item (Join-Path $BundlePath "node\node-x64.exe") -ErrorAction SilentlyContinue
$nodeArm64Item = Get-Item (Join-Path $BundlePath "node\node-arm64.exe") -ErrorAction SilentlyContinue
$installerItem = Get-Item (Join-Path $BundlePath "install.exe") -ErrorAction SilentlyContinue
$nodeX64Size = if ($nodeX64Item) { $nodeX64Item.Length } else { 0 }
$nodeArm64Size = if ($nodeArm64Item) { $nodeArm64Item.Length } else { 0 }
$installerSize = if ($installerItem) { $installerItem.Length } else { 0 }

if ($nodeX64Size -gt 50MB)   { Ok "node-x64.exe size $('{0:N1}' -f ($nodeX64Size/1MB)) MB (> 50 MB)" }   else { Fail "node-x64.exe too small - may be corrupted" }
if ($nodeArm64Size -gt 50MB) { Ok "node-arm64.exe size $('{0:N1}' -f ($nodeArm64Size/1MB)) MB (> 50 MB)" } else { Fail "node-arm64.exe too small - may be corrupted" }
if ($installerSize -gt 10MB) { Ok "install.exe size $('{0:N1}' -f ($installerSize/1MB)) MB (self-contained .NET)" } else { Fail "install.exe suspiciously small - build may have failed" }

# --- Startup validation ------------------------------------------------------

if ($SkipStartup) {
    Write-Host ""
    Skip "Backend health check" "(-SkipStartup specified)"
    Skip "Frontend response check" "(-SkipStartup specified)"
    Skip "Process cleanup" "(-SkipStartup specified)"
} else {
    Write-Host ""
    Write-Host "-- Startup validation -------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Starting services via Start-Scripto.ps1..."

    $launcher = Join-Path $BundlePath "Start-Scripto.ps1"
    $launchProc = Start-Process powershell `
        -ArgumentList "-NonInteractive -ExecutionPolicy Bypass -File `"$launcher`"" `
        -PassThru -WindowStyle Hidden

    Write-Host "  Waiting up to 45s for backend health..."
    $maxWait = 45; $elapsed = 0; $backendOk = $false; $frontendOk = $false
    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds 1; $elapsed++
        try {
            $r = Invoke-WebRequest "http://127.0.0.1:4445/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $backendOk = $true; break }
        } catch {}
    }

    if ($backendOk) {
        Ok "Backend /health returned 200 (${elapsed}s)"

        # Check frontend
        try {
            $fr = Invoke-WebRequest "http://127.0.0.1:4444" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($fr.StatusCode -eq 200) { Ok "Frontend returned 200 on port 4444" }
            else { Fail "Frontend returned $($fr.StatusCode) on port 4444" }
        } catch {
            Fail "Frontend not responding on port 4444" $_.Exception.Message
        }
    } else {
        $logDir = Join-Path $BundlePath "logs"
        Fail "Backend did not become healthy after ${maxWait}s"
        Write-Host "    Check: $logDir\backend-err.log" -ForegroundColor Yellow
    }

    # Verify logs were created
    $logDir = Join-Path $BundlePath "logs"
    if (Test-Path "$logDir\backend.log")  { Ok "backend.log created" }  else { Fail "backend.log not created" }
    if (Test-Path "$logDir\frontend.log") { Ok "frontend.log created" } else { Fail "frontend.log not created" }

    # Verify the desktop WebView2 host actually launched and stayed alive.
    # Start-Scripto.ps1 launches it right after backend health passes; give it a
    # few seconds to initialize WebView2, then confirm the process didn't crash
    # (e.g. a missing WebView2Loader.dll crashes it within ~1s of launch).
    if ($backendOk) {
        Start-Sleep -Seconds 3
        $desktopPidFile = Join-Path $BundlePath "scripto-desktop.pid"
        if (Test-Path $desktopPidFile) {
            $desktopPid = [int](Get-Content $desktopPidFile -Raw).Trim()
            if (Get-Process -Id $desktopPid -ErrorAction SilentlyContinue) {
                Ok "Desktop host launched and still running (PID $desktopPid)"
            } else {
                Fail "Desktop host process exited shortly after launch (crashed on startup?)"
            }
        } else {
            Fail "Desktop host PID file not created - Start-Scripto.ps1 may not have launched it"
        }
    } else {
        Skip "Desktop host check" "(backend never became healthy)"
    }

    # Cleanup - stop processes via Stop-Scripto.ps1, then verify they're actually gone
    Write-Host "  Stopping services..."
    $stopper = Join-Path $BundlePath "Stop-Scripto.ps1"
    Start-Process powershell `
        -ArgumentList "-NonInteractive -ExecutionPolicy Bypass -File `"$stopper`"" `
        -Wait -WindowStyle Hidden

    $backendPidFile = Join-Path $BundlePath "scripto-backend.pid"
    $frontendPidFile = Join-Path $BundlePath "scripto-frontend.pid"
    $desktopPidFile = Join-Path $BundlePath "scripto-desktop.pid"
    $stillRunning = @()
    foreach ($pf in @($backendPidFile, $frontendPidFile, $desktopPidFile)) {
        if (Test-Path $pf) {
            $pid2 = [int](Get-Content $pf -Raw).Trim()
            if (Get-Process -Id $pid2 -ErrorAction SilentlyContinue) { $stillRunning += $pid2 }
        }
    }
    if ($stillRunning.Count -eq 0) {
        Ok "Services stopped via Stop-Scripto.ps1 (verified no processes remain)"
    } else {
        Fail "Stop-Scripto.ps1 left processes running" "PIDs: $($stillRunning -join ', ')"
    }
}

# --- Summary -----------------------------------------------------------------

Write-Host ""
Write-Host "-- Validation summary -------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
if ($fail -eq 0) {
    Write-Host "  RESULT: ALL CHECKS PASSED ($pass passed)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  The bundle is deployment-ready." -ForegroundColor Green
    $zipPath = "$BundlePath.zip"
    if (Test-Path $zipPath) {
        Write-Host "  Zip: $zipPath" -ForegroundColor Cyan
    }
} else {
    Write-Host "  RESULT: $fail FAILED, $pass passed" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Fix the failures above before distributing the bundle." -ForegroundColor Yellow
}
Write-Host ""
exit $(if ($fail -eq 0) { 0 } else { 1 })
