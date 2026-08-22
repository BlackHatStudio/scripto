export type TenantSummary = {
  id: string
  name: string
  slug: string
  role: string
}

export type SessionUser = {
  id: string
  email: string
  displayName: string
  activeTenantId: string | null
  tenants: TenantSummary[]
}

export type TenantSettings = {
  historyRetentionDays: number
  audioRetentionEnabled: boolean
  dictionarySharingEnabled: boolean
  defaultCorrectionBehavior: string
  transcriptionMode: "hybrid" | "local-only"
}

export type TenantDetail = {
  id: string
  name: string
  slug: string
  settings: TenantSettings
}

export type DictationResult = {
  rawTranscript: string
  correctedOutput: string
  confidenceScore: number
  detectedCommand: string | null
  functionApplied: string
  appliedCorrections: Array<{
    kind: string
    before: string
    after: string
    source: string
  }>
}
