import { randomUUID } from "crypto"
import { spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

import { config } from "../config"
import type { TranscriptionProvider } from "../pipeline"

// Runs transcription entirely on-device via a bundled whisper.cpp binary + GGML model, so
// dictation keeps working with no internet connection. The frontend already records audio
// with MediaRecorder and posts it as base64 (see src/app/dictation/page.tsx); this provider
// decodes it, transcodes to the 16kHz mono WAV whisper.cpp expects, and shells out to the
// prebuilt `whisper-cli` binary rather than compiling whisper.cpp at install time.
let loggedUnavailableReason = false

export class LocalWhisperProvider implements TranscriptionProvider {
  static isAvailable(): boolean {
    const binaryExists = fs.existsSync(config.whisperBinaryPath)
    const modelExists = fs.existsSync(config.whisperModelPath)
    if ((!binaryExists || !modelExists) && !loggedUnavailableReason) {
      // Runs once per process so a bad deploy (e.g. antivirus quarantining the
      // unsigned whisper-cli.exe/DLLs during extraction) shows up in backend.log
      // instead of silently falling back to cloud speech recognition.
      loggedUnavailableReason = true
      console.warn(
        "[local-whisper] unavailable - dictation will fall back to cloud speech recognition.",
        `binary (${config.whisperBinaryPath}): ${binaryExists ? "found" : "MISSING"}`,
        `model (${config.whisperModelPath}): ${modelExists ? "found" : "MISSING"}`
      )
    }
    return binaryExists && modelExists
  }

  async transcribe(input: { audioBase64?: string; mimeType?: string; mockTranscript?: string; locale?: string }) {
    if (!input.audioBase64) {
      // No captured audio (e.g. text-only correction testing) — behave like the mock provider.
      return {
        transcript: input.mockTranscript?.trim() || "",
        confidenceScore: input.mockTranscript ? 0.97 : 0,
        provider: "local-whisper",
      }
    }

    if (!LocalWhisperProvider.isAvailable()) {
      throw new Error("Local whisper model is not installed. Set WHISPER_BINARY_PATH / WHISPER_MODEL_PATH or bundle backend/vendor/whisper.")
    }

    const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "scripto-whisper-"))
    const inputPath = path.join(workDir, `input.${extensionForMimeType(input.mimeType)}`)
    const wavPath = path.join(workDir, "audio.wav")

    try {
      await fs.promises.writeFile(inputPath, Buffer.from(input.audioBase64, "base64"))
      await transcodeToWav(inputPath, wavPath)
      const transcript = await runWhisperCli(wavPath, input.locale)
      return {
        transcript: transcript.trim(),
        confidenceScore: transcript.trim() ? 0.85 : 0,
        provider: "local-whisper",
      }
    } finally {
      await fs.promises.rm(workDir, { recursive: true, force: true })
    }
  }
}

function extensionForMimeType(mimeType?: string) {
  if (!mimeType) return "webm"
  if (mimeType.includes("wav")) return "wav"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a"
  return "webm"
}

function resolveFfmpegPath() {
  if (config.ffmpegPath) return config.ffmpegPath
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegStatic = require("ffmpeg-static") as string
  return ffmpegStatic
}

function transcodeToWav(inputPath: string, wavPath: string) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const child = spawn(ffmpegPath, ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath])
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`))
    })
  })
}

function runWhisperCli(wavPath: string, locale?: string) {
  return new Promise<string>((resolve, reject) => {
    const outputBase = path.join(path.dirname(wavPath), `out-${randomUUID()}`)
    const args = [
      "-m", config.whisperModelPath,
      "-f", wavPath,
      "-otxt",
      "-of", outputBase,
      "-nt", // no timestamps in the text output
      "-l", locale?.split("-")[0] || "en",
    ]

    const child = spawn(config.whisperBinaryPath, args)
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`whisper-cli exited with code ${code}: ${stderr.slice(-2000)}`))
        return
      }
      try {
        const text = await fs.promises.readFile(`${outputBase}.txt`, "utf8")
        resolve(text)
      } catch (cause) {
        reject(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
  })
}
