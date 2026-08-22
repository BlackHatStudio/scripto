import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

import { nanoid } from "nanoid"
import { hash as argon2Hash } from "@node-rs/argon2"

import { rolePermissionMap } from "./constants"
import type {
  AppState,
  AuditLogRecord,
  DeviceRecord,
  DictionaryCategoryRecord,
  DictionaryTermRecord,
  EmailProfileRecord,
  EmailSignatureRecord,
  MembershipRecord,
  OAuthIdentityRecord,
  PhraseTemplateRecord,
  RefreshSessionRecord,
  ReplacementRuleRecord,
  SpeechHistoryRecord,
  TenantRecord,
  TenantSettingsRecord,
  UserRecord,
  VoiceFunctionRecord,
} from "./types"

const now = () => new Date().toISOString()

const defaultTenantSettings = (): TenantSettingsRecord => ({
  historyRetentionDays: 30,
  audioRetentionEnabled: false,
  dictionarySharingEnabled: true,
  defaultCorrectionBehavior: "preserve speaking style unless selected mode requires structure",
  transcriptionMode: "hybrid",
})

export const state: AppState = {
  users: [],
  tenants: [],
  memberships: [],
  oauthIdentities: [],
  refreshSessions: [],
  dictionaryCategories: [],
  dictionaryTerms: [],
  replacementRules: [],
  phraseTemplates: [],
  voiceFunctions: [],
  emailProfiles: [],
  emailSignatures: [],
  speechHistory: [],
  auditLogs: [],
  devices: [],
}

const repoRootDir = path.resolve(__dirname, "../../..")
const stateFilePath = path.resolve(repoRootDir, ".local-pg", "speechflow-state.json")
const legacyStateFilePath = path.resolve(repoRootDir, "backend", ".local-pg", "speechflow-state.json")

function persistState() {
  try {
    mkdirSync(path.dirname(stateFilePath), { recursive: true })
    writeFileSync(stateFilePath, JSON.stringify(state, null, 2), "utf8")
  } catch {
    // Persistence is best-effort in local dev.
  }
}

function loadPersistedState() {
  const sourcePath = existsSync(stateFilePath)
    ? stateFilePath
    : existsSync(legacyStateFilePath)
      ? legacyStateFilePath
      : null

  if (!sourcePath) {
    return false
  }

  try {
    const raw = readFileSync(sourcePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<AppState>
    for (const key of Object.keys(state) as (keyof AppState)[]) {
      state[key] = Array.isArray(parsed[key]) ? (parsed[key] as never) : ([] as never)
    }
    if (sourcePath !== stateFilePath) {
      persistState()
    }
    return true
  } catch {
    return false
  }
}

loadPersistedState()

export function resetState() {
  for (const key of Object.keys(state) as (keyof AppState)[]) {
    state[key] = [] as never
  }
  persistState()
}

export function createId() {
  return nanoid()
}

export async function seedDefaults() {
  if (state.dictionaryCategories.length > 0) return

  const seededPasswordHash = await argon2Hash("Password123!")

  const adminUser: UserRecord = {
    id: createId(),
    email: "demo@elevateddynamics.com",
    displayName: "Alex Morgan",
    passwordHash: seededPasswordHash,
    emailVerified: true,
    active: true,
    activeTenantId: null,
    createdAt: now(),
    updatedAt: now(),
  }
  const tenant: TenantRecord = {
    id: createId(),
    name: "Elevated Dynamics",
    slug: "elevated-dynamics",
    ownerUserId: adminUser.id,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    settings: defaultTenantSettings(),
  }
  adminUser.activeTenantId = tenant.id

  const membership: MembershipRecord = {
    id: createId(),
    userId: adminUser.id,
    tenantId: tenant.id,
    role: "TenantOwner",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }

  state.users.push(adminUser)
  state.tenants.push(tenant)
  state.memberships.push(membership)

  state.dictionaryCategories.push(
    ...[
      ["Names", "system"],
      ["Company Names", "tenant"],
      ["Software Terms", "tenant"],
      ["Access Control", "tenant"],
      ["Security Systems", "system"],
      ["Acronyms", "user"],
      ["Technical Terms", "tenant"],
      ["Custom Phrases", "tenant"],
    ].map(([name, scope]) => ({
      id: createId(),
      tenantId: scope === "tenant" ? tenant.id : null,
      name,
      scope: scope as DictionaryCategoryRecord["scope"],
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    }))
  )

  state.dictionaryTerms.push(
    {
      id: createId(),
      tenantId: null,
      ownerUserId: null,
      categoryId: null,
      scope: "system",
      correctText: "Scripto",
      spokenForm: "speech flow",
      phoneticHint: "speech-flow",
      caseSensitive: false,
      enabled: true,
      notes: "System brand term",
      version: 1,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    },
    {
      id: createId(),
      tenantId: tenant.id,
      ownerUserId: adminUser.id,
      categoryId: null,
      scope: "tenant",
      correctText: "Elevated Dynamics",
      spokenForm: "elevated dynamics",
      phoneticHint: "elevated dynamics",
      caseSensitive: false,
      enabled: true,
      notes: "Tenant brand name",
      version: 1,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    }
  )

  state.replacementRules.push({
    id: createId(),
    tenantId: tenant.id,
    ownerUserId: adminUser.id,
    scope: "tenant",
    ruleType: "exact",
    triggerText: "ASAP",
    replacementText: "as soon as possible",
    priority: 90,
    enabled: true,
    caseSensitive: false,
    safeRegex: false,
    notes: "Tenant shared rule",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  })

  state.phraseTemplates.push({
    id: createId(),
    tenantId: tenant.id,
    ownerUserId: adminUser.id,
    scope: "tenant",
    spokenPhrase: "new badge request for amy",
    outputText: "New badge request for {{name}}",
    variables: ["name"],
    enabled: true,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  })

  state.voiceFunctions.push(
    {
      id: createId(),
      tenantId: null,
      ownerUserId: null,
      scope: "system",
      functionName: "Plain dictation",
      description: "Default plain dictation",
      functionType: "plain",
      triggerPhrases: ["plain", "dictation"],
      instruction: "Preserve speaking style.",
      outputFormat: "plain",
      priority: 100,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    },
    {
      id: createId(),
      tenantId: tenant.id,
      ownerUserId: adminUser.id,
      scope: "tenant",
      functionName: "Meeting notes",
      description: "Format notes and action items",
      functionType: "meeting_notes",
      triggerPhrases: ["meeting notes"],
      instruction: "Format speaker notes and action items.",
      outputFormat: "meeting_notes",
      priority: 75,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    }
  )

  state.emailProfiles.push({
    id: createId(),
    tenantId: tenant.id,
    ownerUserId: adminUser.id,
    scope: "tenant",
    profileName: "Default Professional",
    fromDisplayName: adminUser.displayName,
    fromEmail: adminUser.email,
    defaultGreeting: "Hi",
    defaultClosing: "Best",
    tonePreference: "professional",
    enabled: true,
    signatureId: null,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  })

  state.emailSignatures.push({
    id: createId(),
    tenantId: tenant.id,
    profileId: state.emailProfiles[0].id,
    html: "<p>Alex Morgan<br/>Elevated Dynamics</p>",
    plainText: "Alex Morgan\nElevated Dynamics",
    sanitizedHtml: "<p>Alex Morgan<br/>Elevated Dynamics</p>",
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  })

  state.devices.push({
    id: createId(),
    tenantId: tenant.id,
    userId: adminUser.id,
    name: "Chrome on MacBook Pro",
    platform: "web",
    dictionaryVersion: 1,
    lastSeenAt: now(),
    createdAt: now(),
    updatedAt: now(),
    revokedAt: null,
  })

  state.auditLogs.push({
    id: createId(),
    tenantId: tenant.id,
    actorUserId: adminUser.id,
    action: "seed.completed",
    entityType: "system",
    entityId: null,
    metadata: { seededRoles: Object.keys(rolePermissionMap) },
    createdAt: now(),
  })
}

export function touch<T extends { updatedAt: string }>(record: T): T {
  record.updatedAt = now()
  persistState()
  return record
}

export function addAuditLog(entry: Omit<AuditLogRecord, "id" | "createdAt">) {
  state.auditLogs.push({
    id: createId(),
    createdAt: now(),
    ...entry,
  })
  persistState()
}

export function addRefreshSession(session: Omit<RefreshSessionRecord, "id" | "createdAt" | "revokedAt">) {
  const record: RefreshSessionRecord = {
    id: createId(),
    createdAt: now(),
    revokedAt: null,
    ...session,
  }
  state.refreshSessions.push(record)
  persistState()
  return record
}

export function revokeRefreshSession(id: string) {
  const session = state.refreshSessions.find((item) => item.id === id)
  if (session) {
    session.revokedAt = now()
    persistState()
  }
  return session ?? null
}

export function revokeRefreshByTokenHash(tokenHash: string) {
  const session = state.refreshSessions.find((item) => item.tokenHash === tokenHash)
  if (session) {
    session.revokedAt = now()
    persistState()
  }
  return session ?? null
}
