"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { PageLayout } from "@/components/shell/page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api"

type DetectionResponse = {
  detectedCommand: string | null
  functionApplied: string
  selectedModeOverridesDetected: boolean
  resolvedBy: string
}

export default function VoiceFunctionTestPage() {
  const [transcript, setTranscript] = useState("meeting notes for tomorrow")
  const [result, setResult] = useState<DetectionResponse | null>(null)

  async function testDetection() {
    const response = await apiFetch<DetectionResponse>("/voice-functions/test-detection", {
      method: "POST",
      body: JSON.stringify({ transcript, selectedMode: "Meeting Notes" }),
    })
    setResult(response)
  }

  return (
    <PageLayout title="Command Trigger Testing" subtitle="See how transcript text resolves to a function and mode">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Test input</CardTitle>
            <CardDescription>Enter a sample transcript and inspect the priority resolution result.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={transcript} onChange={(event) => setTranscript(event.target.value)} />
            <Button className="w-full" onClick={testDetection}>
              <Search className="h-4 w-4" />
              Test detection
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
            <CardDescription>Explicit selected mode wins before detected commands and function fallbacks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Detected command" value={result?.detectedCommand ?? "None"} />
            <InfoRow label="Function applied" value={result?.functionApplied ?? "Waiting for test"} />
            <InfoRow label="Mode overrides detected" value={result ? String(result.selectedModeOverridesDetected) : "false"} />
            <InfoRow label="Resolution path" value={result?.resolvedBy ?? "Explicit mode > command > tenant > system > plain"} />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</div>
      <div className="mt-2 text-slate-100">{value}</div>
    </div>
  )
}
