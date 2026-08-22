import dotenv from "dotenv"
import path from "path"

dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") })

// Both `npm run dev` and `npm run start` launch the server with cwd set to the
// backend/ directory, so vendored binaries live at backend/vendor/whisper.
const defaultWhisperVendorDir = path.resolve(process.cwd(), "vendor", "whisper")

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN
  const defaults = ["http://localhost:4444", "http://127.0.0.1:4444"]
  const parsed = raw
    ? raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    : []

  return Array.from(new Set([...defaults, ...parsed]))
}

export const config = {
  port: Number(process.env.PORT || 4445),
  host: process.env.HOST || "127.0.0.1",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  corsOrigins: parseCorsOrigins(),
  devEmailVerificationBypass: process.env.DEV_EMAIL_VERIFICATION_BYPASS === "true",
  skipSeedOnStartup: process.env.SKIP_SEED_ON_STARTUP === "true",
  // "local-whisper" runs on-device transcription so dictation works offline; "openai" and
  // "mock" remain for compatibility/testing. See backend/src/transcription/local-whisper.ts.
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || "mock",
  whisperBinaryPath: process.env.WHISPER_BINARY_PATH || path.join(defaultWhisperVendorDir, process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli"),
  whisperModelPath: process.env.WHISPER_MODEL_PATH || path.join(defaultWhisperVendorDir, "ggml-base.en.bin"),
  ffmpegPath: process.env.FFMPEG_PATH || "",
}
