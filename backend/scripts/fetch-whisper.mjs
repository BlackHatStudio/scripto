// Downloads a prebuilt whisper.cpp binary + GGML model into backend/vendor/whisper/ so
// dictation can transcribe speech entirely on-device (no internet needed at runtime). This
// is a one-time ~150MB setup step, not part of `npm install`, since not every dev/CI run
// needs offline transcription available.
//
// Usage: node backend/scripts/fetch-whisper.mjs
import { createWriteStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "node:stream/promises"
import { execFileSync } from "node:child_process"

const WHISPER_RELEASE = "v1.9.1"
const WHISPER_ZIP_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE}/whisper-bin-x64.zip`
const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"

const backendDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const vendorDir = path.join(backendDir, "vendor", "whisper")

async function download(url, destPath) {
  console.log(`Downloading ${url}`)
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  await pipeline(response.body, createWriteStream(destPath))
}

async function main() {
  if (process.platform !== "win32") {
    console.error(
      `This script only fetches the Windows x64 whisper.cpp build. For other platforms, download the ` +
      `matching release asset from https://github.com/ggml-org/whisper.cpp/releases and a GGML model from ` +
      `https://huggingface.co/ggerganov/whisper.cpp, then place the whisper-cli binary + model in ${vendorDir}.`
    )
    process.exit(1)
  }

  await fs.mkdir(vendorDir, { recursive: true })

  const modelPath = path.join(vendorDir, "ggml-base.en.bin")
  if (await fs.access(modelPath).then(() => true, () => false)) {
    console.log("Model already present, skipping download:", modelPath)
  } else {
    await download(MODEL_URL, modelPath)
  }

  const binaryPath = path.join(vendorDir, "whisper-cli.exe")
  if (await fs.access(binaryPath).then(() => true, () => false)) {
    console.log("Binary already present, skipping download:", binaryPath)
  } else {
    const zipPath = path.join(vendorDir, "whisper-bin-x64.zip")
    await download(WHISPER_ZIP_URL, zipPath)

    const extractDir = path.join(vendorDir, "extracted")
    await fs.rm(extractDir, { recursive: true, force: true })
    // Use PowerShell's Expand-Archive rather than `tar`: GNU tar (e.g. from a Git Bash
    // PATH) misparses a "C:\..." destination as remote-host syntax ("user@host:path"),
    // and this path is win32-only anyway, so PowerShell is always available.
    execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    ], { stdio: "inherit" })
    // The release zip nests everything under Release/ or a top-level dir - locate it.
    const releaseDir = await findReleaseDir(extractDir)

    for (const entry of await fs.readdir(releaseDir)) {
      if (entry.endsWith(".exe") || entry.endsWith(".dll")) {
        if (entry.startsWith("whisper-cli") || entry.endsWith(".dll")) {
          await fs.copyFile(path.join(releaseDir, entry), path.join(vendorDir, entry))
        }
      }
    }

    await fs.rm(extractDir, { recursive: true, force: true })
    await fs.rm(zipPath, { force: true })
  }

  console.log("Done. Vendored whisper.cpp assets are in", vendorDir)
  console.log('Set TRANSCRIPTION_PROVIDER=local-whisper in backend/.env to enable offline dictation.')
}

// The whisper-bin-x64.zip release asset contains a top-level Release/ folder holding the
// binaries directly; search one level deep in case a future release nests it differently.
async function findReleaseDir(root) {
  if (await containsWhisperCli(root)) return root

  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(root, entry.name)
    if (await containsWhisperCli(candidate)) return candidate
  }
  throw new Error(`Could not locate whisper-cli binary inside extracted archive at ${root}`)
}

async function containsWhisperCli(dir) {
  const entries = await fs.readdir(dir).catch(() => [])
  return entries.some((name) => name.startsWith("whisper-cli"))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
