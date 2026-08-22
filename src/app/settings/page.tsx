"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, ShieldCheck } from "lucide-react"

import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api"
import type { TenantDetail, TenantSettings } from "@/lib/types"

type TranscriptionMode = TenantSettings["transcriptionMode"]

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [localTranscriptionAvailable, setLocalTranscriptionAvailable] = useState<boolean | null>(null)
  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("hybrid")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [tenantDetail, capabilities] = await Promise.all([
          apiFetch<TenantDetail>("/tenants/current"),
          apiFetch<{ localTranscription: boolean; transcriptionMode: TranscriptionMode }>("/speech/capabilities"),
        ])
        if (cancelled) return
        setTenant(tenantDetail)
        setSelectedMode(tenantDetail.settings.transcriptionMode)
        setLocalTranscriptionAvailable(capabilities.localTranscription)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Failed to load settings")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveTranscriptionMode(mode: TranscriptionMode) {
    if (!tenant) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await apiFetch<TenantSettings>(`/tenants/${tenant.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ transcriptionMode: mode }),
      })
      setTenant({ ...tenant, settings: updated })
      setSelectedMode(updated.transcriptionMode)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to update transcription policy"
      if (message.toLowerCase().includes("permission")) {
        setReadOnly(true)
      }
      setError(message)
      // Revert the dropdown to the last saved value on failure.
      setSelectedMode(tenant.settings.transcriptionMode)
    } finally {
      setSaving(false)
    }
  }

  const localOnlyBlocked = selectedMode === "local-only" && localTranscriptionAvailable === false

  return (
    <PageLayout title="Settings" subtitle="Organization-wide policies for this tenant">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Transcription policy</CardTitle>
              <CardDescription>
                Controls whether dictation is allowed to use the browser&apos;s cloud speech service as a fallback.
              </CardDescription>
            </div>
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={localTranscriptionAvailable ? "secondary" : "outline"}>
                  Local model {localTranscriptionAvailable ? "installed" : "not installed"} on this server
                </Badge>
                {readOnly ? <Badge variant="outline">Read-only — admin permission required</Badge> : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Mode</label>
                <Select
                  value={selectedMode}
                  onValueChange={(value) => setSelectedMode(value as TranscriptionMode)}
                  disabled={saving || readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transcription mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Local-first, cloud fallback (hybrid)</SelectItem>
                    <SelectItem value="local-only">Strictly offline (local only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                {selectedMode === "hybrid" ? (
                  <p>
                    Dictation prefers the on-device whisper model. If it isn&apos;t installed, the browser falls back
                    to the Web Speech API, which sends audio to Google or Microsoft&apos;s cloud service.
                  </p>
                ) : (
                  <p>
                    Dictation only uses the on-device whisper model. Audio never leaves this machine. If the local
                    model isn&apos;t installed, dictation is blocked instead of falling back to a cloud service.
                  </p>
                )}
              </div>

              {localOnlyBlocked ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
                  Strict offline mode is selected, but the local speech model isn&apos;t installed on this server.
                  Dictation will fail until it&apos;s installed (run <code>npm run fetch-whisper</code> on the
                  backend) or you switch back to hybrid mode.
                </div>
              ) : null}

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {saving ? (
                <p className="text-sm text-cyan-200">Saving…</p>
              ) : saved ? (
                <p className="text-sm text-emerald-300">Saved.</p>
              ) : null}

              <Button
                variant="outline"
                size="compact"
                disabled={saving || readOnly || selectedMode === tenant?.settings.transcriptionMode}
                onClick={() => void saveTranscriptionMode(selectedMode)}
              >
                Save
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
