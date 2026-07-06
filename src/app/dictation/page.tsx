"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Check,
  ClipboardCopy,
  LoaderCircle,
  Mic,
  MicOff,
  Trash2,
} from "lucide-react"

import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api"
import type { DictationResult } from "@/lib/types"

const modes = [
  "Plain",
  "Email",
  "List",
  "Text Message",
  "Codex / Cursor Prompt",
  "Meeting Notes",
  "Custom Function",
]

type SpeechRecognitionResultLike = {
  isFinal: boolean
  [index: number]: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionInstanceLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string; message?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike

export default function DictationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <DictationPageShell />
    </Suspense>
  )
}

function DictationPageShell() {
  const searchParams = useSearchParams()
  const desktopMode = searchParams.get("desktop") === "1"
  const [mode, setMode] = useState("Plain")
  const [mockTranscript, setMockTranscript] = useState(
    "new badge request for amy and send a follow up email tomorrow"
  )
  const [selectedFunction, setSelectedFunction] = useState("")
  const [saveHistory, setSaveHistory] = useState(true)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [result, setResult] = useState<DictationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [microphoneStatus, setMicrophoneStatus] = useState<string | null>(null)
  const [localTranscriptionAvailable, setLocalTranscriptionAvailable] = useState<boolean | null>(null)
  const [transcriptionMode, setTranscriptionMode] = useState<"hybrid" | "local-only">("hybrid")
  const completionSent = useRef(false)
  const startRecordingRef = useRef<() => Promise<void> | void>(() => {})
  const speechRecognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null)
  const speechTranscriptRef = useRef("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ localTranscription: boolean; transcriptionMode: "hybrid" | "local-only" }>("/speech/capabilities")
      .then((response) => {
        if (cancelled) return
        setLocalTranscriptionAvailable(response.localTranscription)
        setTranscriptionMode(response.transcriptionMode)
      })
      .catch(() => {
        // Backend unreachable or capability check failed - fall back to the browser's
        // (cloud-dependent) Web Speech API rather than blocking dictation entirely.
        if (!cancelled) setLocalTranscriptionAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const appliedCorrections = useMemo(() => result?.appliedCorrections ?? [], [result])

  useEffect(() => {
    if (!desktopMode || !result || completionSent.current) return
    completionSent.current = true

    const webviewBridge = window.chrome?.webview
    if (webviewBridge) {
      webviewBridge.postMessage({
        type: "completeDictation",
        text: result.correctedOutput,
      })
      return
    }

    const desktopBridge = window.speechflowDesktop
    if (desktopBridge) {
      void desktopBridge.completeDictation(result.correctedOutput)
    }
  }, [desktopMode, result])

  useEffect(() => {
    const postDesktopMessage = (message: Record<string, unknown>) => {
      window.chrome?.webview?.postMessage(message)
    }

    const onWebViewMessage = (event: MessageEvent) => {
      if (event.data?.type === "startRecording") {
        void startRecordingRef.current()
        return
      }

      if (event.data?.type === "stopRecording") {
        stopRecording()
      }
    }

    window.chrome?.webview?.addEventListener("message", onWebViewMessage)
    postDesktopMessage({ type: "dictationReady" })
    return () => window.chrome?.webview?.removeEventListener("message", onWebViewMessage)
  }, [])

  async function startRecording() {
    if (recording || transcribing || speechRecognitionRef.current || mediaRecorderRef.current) return

    // Local-first: prefer the on-device whisper model (works offline) and only fall back to
    // the browser's Web Speech API - which streams audio to Google/Microsoft's cloud - when
    // the backend reports no local model is installed.
    if (localTranscriptionAvailable) {
      await startMediaRecorderRecording()
      return
    }

    if (transcriptionMode === "local-only") {
      // Tenant policy requires strictly offline transcription - never fall back to a cloud
      // speech service, even if that means dictation is unavailable right now.
      setError(
        "This organization requires offline transcription, but the local speech model isn't installed on the server. Contact an admin or switch to hybrid mode in Settings."
      )
      return
    }

    const SpeechRecognition = getSpeechRecognitionConstructor()
    if (!SpeechRecognition) {
      setError("Live microphone transcription is not supported in this browser. Use Chrome or Edge.")
      return
    }

    startSpeechRecognition(new SpeechRecognition())
  }

  startRecordingRef.current = startRecording

  async function startMediaRecorderRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(
        (candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: BlobPart[] = []
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onerror = () => {
        cleanupMediaRecorder()
        setError("Recording failed. Please try again.")
        setRecording(false)
        setMicrophoneStatus(null)
      }

      recorder.onstop = async () => {
        cleanupMediaRecorder()
        setRecording(false)
        setMicrophoneStatus(null)

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
        if (blob.size === 0) {
          setError("No audio was captured from the microphone.")
          return
        }

        const audioBase64 = await blobToBase64(blob)
        await submit(audioBase64, undefined, blob.type)
      }

      recorder.start()
      setRecording(true)
      setMicrophoneStatus("Listening to your microphone (offline transcription)")
    } catch (cause) {
      cleanupMediaRecorder()
      const message = cause instanceof Error ? cause.message : "Unable to access the microphone"
      setError(message)
      setRecording(false)
      setMicrophoneStatus(null)
    }
  }

  function cleanupMediaRecorder() {
    mediaRecorderRef.current = null
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      return
    }
    if (!speechRecognitionRef.current) return
    speechRecognitionRef.current.stop()
  }

  async function submit(audioBase64?: string, transcriptOverride?: string, mimeType?: string) {
    setTranscribing(true)
    setError(null)
    try {
      const response = await apiFetch<DictationResult>("/speech/dictate", {
        method: "POST",
        body: JSON.stringify({
          mode,
          mockTranscript: transcriptOverride ?? mockTranscript,
          selectedFunction,
          saveHistory,
          audioBase64,
          mimeType: audioBase64 ? mimeType || "audio/webm" : undefined,
        }),
      })
      setResult(response)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Dictation failed"
      setError(message)
      if (desktopMode) {
        window.chrome?.webview?.postMessage({ type: "dictationError", message })
      }
    } finally {
      setTranscribing(false)
    }
  }

  function getSpeechRecognitionConstructor() {
    if (typeof window === "undefined") return null
    const globalWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike
    }

    return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null
  }

  function startSpeechRecognition(recognition: SpeechRecognitionInstanceLike) {
    const transcriptChunks: string[] = []
    speechTranscriptRef.current = ""
    speechRecognitionRef.current = recognition

    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const chunks: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript?.trim()
        if (!transcript) continue
        if (result.isFinal) {
          transcriptChunks.push(transcript)
        } else {
          chunks.push(transcript)
        }
      }

      const combined = [...transcriptChunks, ...chunks].join(" ").replace(/\s+/g, " ").trim()
      speechTranscriptRef.current = combined
      if (combined) {
        setMockTranscript(combined)
      }
    }

    recognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Microphone access was denied."
        : event.error === "no-speech"
          ? "No speech was detected from the microphone."
        : event.message || "Unable to access microphone speech recognition"
      setError(message)
      setMicrophoneStatus(null)
      setRecording(false)
      setTranscribing(false)
      speechRecognitionRef.current = null
      recognition.abort()
      window.chrome?.webview?.postMessage({ type: "dictationError", message })
    }

    recognition.onend = async () => {
      speechRecognitionRef.current = null
      setRecording(false)
      const transcript = speechTranscriptRef.current.trim()
      setMicrophoneStatus(null)

      if (!transcript) {
        setError("No speech was captured from the microphone.")
        return
      }

      await submit(undefined, transcript)
    }

    try {
      recognition.start()
      setRecording(true)
      setMicrophoneStatus("Listening to your microphone")
    } catch (cause) {
      speechRecognitionRef.current = null
      const message = cause instanceof Error ? cause.message : "Unable to start microphone speech recognition"
      setError(message)
      setRecording(false)
      setMicrophoneStatus(null)
      window.chrome?.webview?.postMessage({ type: "dictationError", message })
    }
  }

  async function copyOutput() {
    if (!result) return
    await navigator.clipboard.writeText(result.correctedOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <PageLayout
      title="Browser Dictation"
      subtitle="Capture audio, route it through the API, and review correction output before saving."
    >
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Use the mock transcript for predictable local testing.</CardDescription>
            <Badge
              variant={
                localTranscriptionAvailable === null
                  ? "outline"
                  : localTranscriptionAvailable
                    ? "secondary"
                    : transcriptionMode === "local-only"
                      ? "warning"
                      : "outline"
              }
              className="w-fit"
            >
              {localTranscriptionAvailable === null
                ? "Checking transcription mode…"
                : localTranscriptionAvailable
                  ? "Local transcription (offline)"
                  : transcriptionMode === "local-only"
                    ? "Offline required — local model missing"
                    : "Cloud transcription (requires internet)"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Mode</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {modes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Sample transcript</label>
              <Textarea value={mockTranscript} onChange={(event) => setMockTranscript(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Custom function</label>
              <Input
                value={selectedFunction}
                onChange={(event) => setSelectedFunction(event.target.value)}
                placeholder="Optional function name"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  if (recording) {
                    stopRecording()
                    return
                  }
                  void startRecording()
                }}
                variant={recording ? "destructive" : "default"}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {recording ? "Stop recording" : "Record and transcribe"}
              </Button>
              <Button onClick={() => submit()} disabled={transcribing}>
                {transcribing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Run correction
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={saveHistory} onChange={(event) => setSaveHistory(event.target.checked)} />
              Save correction history if tenant settings allow it
            </label>
            {microphoneStatus ? <p className="text-sm text-cyan-200">{microphoneStatus}</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Result</CardTitle>
                  <CardDescription>Raw transcript, corrected output, and metadata.</CardDescription>
                </div>
                {result ? (
                  <Button variant="outline" onClick={copyOutput}>
                    <ClipboardCopy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy output"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Raw transcript</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{result?.rawTranscript ?? "Waiting for input..."}</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Corrected output</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-cyan-50">{result?.correctedOutput ?? "No correction run yet."}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Detected command" value={result?.detectedCommand ?? "None"} />
                <Metric label="Function applied" value={result?.functionApplied ?? "Plain dictation"} />
                <Metric label="Confidence" value={result ? `${Math.round(result.confidenceScore * 100)}%` : "0%"} />
                <Metric label="Corrections" value={String(appliedCorrections.length)} />
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-200">Applied corrections</div>
                <div className="grid gap-3">
                  {appliedCorrections.length ? (
                    appliedCorrections.map((entry, index) => (
                      <div key={`${entry.source}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.kind}</Badge>
                          <Badge variant="secondary">{entry.source}</Badge>
                        </div>
                        <p className="mt-2 text-slate-400">
                          <span className="text-slate-200">{entry.before}</span> → {entry.after}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                      No corrections applied yet.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History control</CardTitle>
              <CardDescription>History remains optional until tenant policy enables it.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Audio retention is disabled in MVP UI and audio is discarded after temporary processing.
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm text-slate-100">{value}</div>
    </div>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip the "data:<mime>;base64," prefix - the backend expects raw base64.
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read recorded audio"))
    reader.readAsDataURL(blob)
  })
}
