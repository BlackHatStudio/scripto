import type { FunctionType, DictionaryScope, ModeName, RuleType } from "./constants"

export type Id = string

export type UserRecord = {
  id: Id
  email: string
  displayName: string
  passwordHash: string
  emailVerified: boolean
  active: boolean
  activeTenantId: Id | null
  createdAt: string
  updatedAt: string
}

export type TenantRecord = {
  id: Id
  name: string
  slug: string
  ownerUserId: Id
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  settings: TenantSettingsRecord
}

export type TenantSettingsRecord = {
  historyRetentionDays: number
  audioRetentionEnabled: boolean
  dictionarySharingEnabled: boolean
  defaultCorrectionBehavior: string
  // "local-only" enforces on-device transcription and refuses to dictate rather than ever
  // sending audio to a cloud speech service; "hybrid" allows the browser's Web Speech API
  // fallback when the local model isn't available. See LocalWhisperProvider.
  transcriptionMode: "hybrid" | "local-only"
}

export type MembershipRecord = {
  id: Id
  userId: Id
  tenantId: Id
  role: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type OAuthIdentityRecord = {
  id: Id
  userId: Id
  provider: "google" | "apple"
  providerUserId: string
  createdAt: string
}

export type RefreshSessionRecord = {
  id: Id
  userId: Id
  tenantId: Id | null
  deviceId: Id
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

export type DictionaryCategoryRecord = {
  id: Id
  tenantId: Id | null
  name: string
  scope: "system" | "tenant" | "user"
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type DictionaryTermRecord = {
  id: Id
  tenantId: Id | null
  ownerUserId: Id | null
  categoryId: Id | null
  scope: DictionaryScope
  correctText: string
  spokenForm: string
  phoneticHint: string
  caseSensitive: boolean
  enabled: boolean
  notes: string
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ReplacementRuleRecord = {
  id: Id
  tenantId: Id | null
  ownerUserId: Id | null
  scope: DictionaryScope
  ruleType: RuleType
  triggerText: string
  replacementText: string
  priority: number
  enabled: boolean
  caseSensitive: boolean
  safeRegex: boolean
  notes: string
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type PhraseTemplateRecord = {
  id: Id
  tenantId: Id | null
  ownerUserId: Id | null
  scope: DictionaryScope
  spokenPhrase: string
  outputText: string
  variables: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type VoiceFunctionRecord = {
  id: Id
  tenantId: Id | null
  ownerUserId: Id | null
  scope: DictionaryScope
  functionName: string
  description: string
  functionType: FunctionType
  triggerPhrases: string[]
  instruction: string
  outputFormat: string
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type EmailProfileRecord = {
  id: Id
  tenantId: Id | null
  ownerUserId: Id | null
  scope: DictionaryScope
  profileName: string
  fromDisplayName: string
  fromEmail: string
  defaultGreeting: string
  defaultClosing: string
  tonePreference: string
  enabled: boolean
  signatureId: Id | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type EmailSignatureRecord = {
  id: Id
  tenantId: Id | null
  profileId: Id | null
  html: string
  plainText: string
  sanitizedHtml: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type SpeechHistoryRecord = {
  id: Id
  tenantId: Id
  userId: Id
  mode: ModeName
  detectedCommand: string | null
  functionApplied: string
  rawTranscript: string
  correctedOutput: string
  correctionsApplied: Array<{ kind: string; before: string; after: string; source: string }>
  confidenceScore: number
  status: "accepted" | "modified" | "discarded"
  saved: boolean
  createdAt: string
  updatedAt: string
}

export type AuditLogRecord = {
  id: Id
  tenantId: Id | null
  actorUserId: Id | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type DeviceRecord = {
  id: Id
  tenantId: Id | null
  userId: Id
  name: string
  platform: string
  dictionaryVersion: number
  lastSeenAt: string
  createdAt: string
  updatedAt: string
  revokedAt: string | null
}

export type SessionContext = {
  userId: Id
  activeTenantId: Id | null
  email: string
}

export type AppState = {
  users: UserRecord[]
  tenants: TenantRecord[]
  memberships: MembershipRecord[]
  oauthIdentities: OAuthIdentityRecord[]
  refreshSessions: RefreshSessionRecord[]
  dictionaryCategories: DictionaryCategoryRecord[]
  dictionaryTerms: DictionaryTermRecord[]
  replacementRules: ReplacementRuleRecord[]
  phraseTemplates: PhraseTemplateRecord[]
  voiceFunctions: VoiceFunctionRecord[]
  emailProfiles: EmailProfileRecord[]
  emailSignatures: EmailSignatureRecord[]
  speechHistory: SpeechHistoryRecord[]
  auditLogs: AuditLogRecord[]
  devices: DeviceRecord[]
}
