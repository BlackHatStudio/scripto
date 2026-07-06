import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import sanitizeHtml from "sanitize-html"
import jwt from "jsonwebtoken"
import { z } from "zod"

import { config } from "./config"
import {
  permissions,
  rolePermissionMap,
  roles,
  functionTypes,
} from "./constants"
import {
  authMiddleware,
  errorHandler,
  requirePermission,
  tenantContextMiddleware,
  type AuthedRequest,
} from "./middleware"
import {
  signupSchema,
  loginSchema,
  switchTenantSchema,
  updateRolesSchema,
  dictionaryCategorySchema,
  dictionaryTermSchema,
  replacementRuleSchema,
  phraseTemplateSchema,
  voiceFunctionSchema,
  emailProfileSchema,
  emailSignatureSchema,
  dictationSchema,
  correctionTextSchema,
  testDetectionSchema,
  historyFeedbackSchema,
  deviceDictionaryPushSchema,
} from "./schemas"
import { MockTranscriptionProvider, OpenAIWhisperCompatibleProvider, applyReplacementRules, applyTemplates, formatTranscript, resolveVoiceFunction } from "./pipeline"
import { LocalWhisperProvider } from "./transcription/local-whisper"
import {
  addAuditLog,
  addRefreshSession,
  createId,
  seedDefaults,
  state,
  touch,
} from "./store"
import {
  createAccessToken,
  createRefreshToken,
  hashPassword,
  verifyPassword,
  rotateRefreshToken,
  revokeRefreshToken,
} from "./services/auth"
import { query } from "./db"
import type {
  DictionaryCategoryRecord,
  DictionaryTermRecord,
  EmailProfileRecord,
  EmailSignatureRecord,
  PhraseTemplateRecord,
  ReplacementRuleRecord,
  VoiceFunctionRecord,
} from "./types"

const app = express()
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })
const dictationRateLimit = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })

app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin not allowed: ${origin}`))
    },
    credentials: true,
  })
)
// 25mb covers a several-minute base64-encoded audio recording from the dictation MediaRecorder path.
app.use(express.json({ limit: "25mb" }))
app.use(cookieParser())
app.use("/api/auth", authRateLimit)
app.use("/api/speech", dictationRateLimit)

app.get("/health", (_req, res) => res.json({ ok: true, service: "speechflow-backend" }))

app.get("/api/health/database", async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        now() AS server_time
    `)

    res.json({
      ok: true,
      database: result.rows[0],
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Database health check failed:", error)

    res.status(500).json({
      ok: false,
      error: "Database connection failed",
    })
  }
})

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body)
    if (state.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) {
      return res.status(409).json({ error: "Email is already registered" })
    }

    const user = {
      id: createId(),
      displayName: body.displayName,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      emailVerified: config.devEmailVerificationBypass,
      active: true,
      activeTenantId: null as string | null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const tenant = {
      id: createId(),
      name: body.tenantName,
      slug: body.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      ownerUserId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      settings: {
        historyRetentionDays: 30,
        audioRetentionEnabled: false,
        dictionarySharingEnabled: true,
        defaultCorrectionBehavior: "preserve speaking style unless selected function requires structure",
        transcriptionMode: "hybrid" as const,
      },
    }
    user.activeTenantId = tenant.id

    state.users.push(user)
    state.tenants.push(tenant)
    state.memberships.push({
      id: createId(),
      userId: user.id,
      tenantId: tenant.id,
      role: "TenantOwner",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    addAuditLog({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email, signup: true },
    })

    const accessToken = createAccessToken(user)
    const refresh = await createRefreshToken(user.id, tenant.id)

    res.json({
      user: publicUser(user),
      tenant: publicTenant(tenant),
      memberships: membershipsForUser(user.id),
      accessToken,
      refreshToken: refresh.token,
      activeTenantId: tenant.id,
    })
  } catch (error) {
    next(error)
  }
})

app.post("/api/auth/login", async (req, res) => {
  const body = loginSchema.parse(req.body)
  const user = state.users.find((item) => item.email.toLowerCase() === body.email.toLowerCase() && item.active)

  if (!user) {
    addAuditLog({
      tenantId: null,
      actorUserId: null,
      action: "failed_login",
      entityType: "auth",
      entityId: null,
      metadata: { email: body.email },
    })
    return res.status(401).json({ error: "Invalid credentials" })
  }

  const verified = await verifyPassword(user.passwordHash, body.password)
  if (!verified) {
    addAuditLog({
      tenantId: user.activeTenantId,
      actorUserId: user.id,
      action: "failed_login",
      entityType: "auth",
      entityId: user.id,
      metadata: { email: user.email },
    })
    return res.status(401).json({ error: "Invalid credentials" })
  }

  const accessToken = createAccessToken(user)
  const refresh = await createRefreshToken(user.id, user.activeTenantId)
  addAuditLog({
    tenantId: user.activeTenantId,
    actorUserId: user.id,
    action: "login",
    entityType: "auth",
    entityId: user.id,
    metadata: { email: user.email },
  })

  res.json({
    user: publicUser(user),
    tenants: membershipsForUser(user.id),
    accessToken,
    refreshToken: refresh.token,
    activeTenantId: user.activeTenantId,
  })
})

app.post("/api/auth/logout", authMiddleware, async (req: AuthedRequest, res) => {
  const refreshToken = z.object({ refreshToken: z.string().min(1) }).parse(req.body).refreshToken
  await revokeRefreshToken(refreshToken)
  addAuditLog({
    tenantId: req.auth?.activeTenantId ?? null,
    actorUserId: req.auth?.userId ?? null,
    action: "logout",
    entityType: "auth",
    entityId: req.auth?.userId ?? null,
    metadata: {},
  })
  res.json({ ok: true })
})

app.post("/api/auth/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body)
    const rotated = await rotateRefreshToken(refreshToken)
    const user = state.users.find((item) => item.id === rotated.userId)
    if (!user) {
      return res.status(401).json({ error: "Refresh token is invalid" })
    }
    user.activeTenantId = rotated.tenantId
    res.json({
      accessToken: createAccessToken(user),
      refreshToken: rotated.next.token,
      activeTenantId: user.activeTenantId,
    })
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Refresh token is invalid" })
    }
    next(error)
  }
})

app.get("/api/auth/me", authMiddleware, (req: AuthedRequest, res) => {
  const user = state.users.find((item) => item.id === req.auth?.userId)
  if (!user) return res.status(404).json({ error: "User not found" })
  res.json({
    user: publicUser(user),
    tenants: membershipsForUser(user.id),
    activeTenantId: user.activeTenantId,
  })
})

app.get("/api/auth/oauth/google", (_req, res) => {
  res.json({ ok: true, provider: "google", message: "OAuth wiring placeholder" })
})

app.get("/api/auth/oauth/apple", (_req, res) => {
  res.json({ ok: true, provider: "apple", message: "OAuth wiring placeholder" })
})

app.get("/api/tenants", authMiddleware, (req: AuthedRequest, res) => {
  const memberships = membershipsForUser(req.auth!.userId)
  res.json(memberships)
})

app.post("/api/tenants", authMiddleware, async (req: AuthedRequest, res) => {
  const body = z.object({ name: z.string().min(2) }).parse(req.body)
  const user = state.users.find((item) => item.id === req.auth!.userId)
  if (!user) return res.status(404).json({ error: "User not found" })

  const tenant = {
    id: createId(),
    name: body.name,
    slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    ownerUserId: user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    settings: {
      historyRetentionDays: 30,
      audioRetentionEnabled: false,
      dictionarySharingEnabled: true,
      defaultCorrectionBehavior: "preserve speaking style unless selected function requires structure",
      transcriptionMode: "hybrid" as const,
    },
  }

  state.tenants.push(tenant)
  state.memberships.push({
    id: createId(),
    userId: user.id,
    tenantId: tenant.id,
    role: "TenantOwner",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  user.activeTenantId = tenant.id
  addAuditLog({
    tenantId: tenant.id,
    actorUserId: user.id,
    action: "tenant.created",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: { name: tenant.name },
  })

  res.json(publicTenant(tenant))
})

app.get("/api/tenants/current", authMiddleware, (req: AuthedRequest, res) => {
  const tenant = state.tenants.find((item) => item.id === req.auth?.activeTenantId)
  if (!tenant) return res.status(404).json({ error: "Tenant not found" })
  res.json(publicTenant(tenant))
})

app.post("/api/tenants/switch", authMiddleware, (req: AuthedRequest, res) => {
  const body = switchTenantSchema.parse(req.body)
  const user = state.users.find((item) => item.id === req.auth!.userId)
  const membership = state.memberships.find(
    (item) => item.userId === req.auth!.userId && item.tenantId === body.tenantId && item.active
  )
  if (!user || !membership) return res.status(403).json({ error: "Tenant membership required" })
  user.activeTenantId = body.tenantId
  addAuditLog({
    tenantId: body.tenantId,
    actorUserId: user.id,
    action: "tenant.switched",
    entityType: "tenant",
    entityId: body.tenantId,
    metadata: {},
  })
  res.json({ accessToken: createAccessToken(user), activeTenantId: user.activeTenantId })
})

app.get("/api/tenants/:tenantId/settings", authMiddleware, tenantContextMiddleware, (req: AuthedRequest, res) => {
  const tenant = state.tenants.find((item) => item.id === req.params.tenantId)
  if (!tenant) return res.status(404).json({ error: "Tenant not found" })
  res.json(tenant.settings)
})

app.patch("/api/tenants/:tenantId/settings", authMiddleware, tenantContextMiddleware, requirePermission("settings.manage"), (req: AuthedRequest, res) => {
  const tenant = state.tenants.find((item) => item.id === req.params.tenantId)
  if (!tenant) return res.status(404).json({ error: "Tenant not found" })
  const body = z.object({
    historyRetentionDays: z.number().int().min(0).optional(),
    audioRetentionEnabled: z.boolean().optional(),
    dictionarySharingEnabled: z.boolean().optional(),
    defaultCorrectionBehavior: z.string().optional(),
    transcriptionMode: z.enum(["hybrid", "local-only"]).optional(),
  }).parse(req.body)
  Object.assign(tenant.settings, body)
  touch(tenant)
  addAuditLog({
    tenantId: tenant.id,
    actorUserId: req.auth!.userId,
    action: "tenant.settings.updated",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: body,
  })
  res.json(tenant.settings)
})

app.get("/api/admin/users", authMiddleware, tenantContextMiddleware, requirePermission("users.manage"), (_req, res) => {
  res.json(
    state.users.map((user) => ({
      ...publicUser(user),
      tenants: membershipsForUser(user.id),
    }))
  )
})

app.patch("/api/admin/users/:userId/roles", authMiddleware, tenantContextMiddleware, requirePermission("roles.manage"), (req: AuthedRequest, res) => {
  const body = updateRolesSchema.parse(req.body)
  const membership = state.memberships.find(
    (item) => item.userId === req.params.userId && item.tenantId === req.tenantId
  )
  if (!membership) return res.status(404).json({ error: "Membership not found" })
  membership.role = body.role
  touch(membership)
  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "role.changed",
    entityType: "membership",
    entityId: membership.id,
    metadata: { role: body.role, userId: req.params.userId },
  })
  res.json({ ok: true, membership })
})

app.get("/api/admin/roles", authMiddleware, tenantContextMiddleware, requirePermission("roles.manage"), (_req, res) => {
  res.json(Object.keys(rolePermissionMap).map((role) => ({ role, permissions: rolePermissionMap[role as keyof typeof rolePermissionMap] })))
})

app.get("/api/admin/permissions", authMiddleware, tenantContextMiddleware, requirePermission("roles.manage"), (_req, res) => {
  res.json(permissions)
})

app.get("/api/dictionary/categories", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (req: AuthedRequest, res) => {
  const items = state.dictionaryCategories.filter((item) => !item.deletedAt && (item.scope === "system" || item.tenantId === req.tenantId || item.scope === "user"))
  res.json(items)
})

app.post("/api/dictionary/categories", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.write.shared"), (req: AuthedRequest, res) => {
  const body = dictionaryCategorySchema.parse(req.body)
  const record: DictionaryCategoryRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    name: body.name,
    scope: body.scope,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.dictionaryCategories.push(record)
  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "dictionary.category.created",
    entityType: "dictionaryCategory",
    entityId: record.id,
    metadata: record,
  })
  res.status(201).json(record)
})

app.get("/api/dictionary/terms", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (req: AuthedRequest, res) => {
  res.json(dictionaryTermsForTenant(req))
})

app.post("/api/dictionary/terms", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.write.personal"), (req: AuthedRequest, res) => {
  const body = dictionaryTermSchema.parse(req.body)
  const record: DictionaryTermRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    ownerUserId: body.scope === "personal" ? req.auth!.userId : null,
    categoryId: body.categoryId ?? null,
    scope: body.scope,
    correctText: body.correctText,
    spokenForm: body.spokenForm?.trim() || body.correctText,
    phoneticHint: body.phoneticHint ?? "",
    caseSensitive: body.caseSensitive,
    enabled: body.enabled,
    notes: body.notes ?? "",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.dictionaryTerms.push(record)
  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "dictionary.term.created",
    entityType: "dictionaryTerm",
    entityId: record.id,
    metadata: record,
  })
  res.status(201).json(record)
})

app.patch("/api/dictionary/terms/:id", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.write.personal"), (req: AuthedRequest, res) => {
  const record = state.dictionaryTerms.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Dictionary term not found" })
  const body = dictionaryTermSchema.partial().parse(req.body)
  Object.assign(record, body, { version: record.version + 1 })
  touch(record)
  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "dictionary.term.updated",
    entityType: "dictionaryTerm",
    entityId: record.id,
    metadata: body,
  })
  res.json(record)
})

app.delete("/api/dictionary/terms/:id", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.write.personal"), (req: AuthedRequest, res) => {
  const record = state.dictionaryTerms.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Dictionary term not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "dictionary.term.deleted",
    entityType: "dictionaryTerm",
    entityId: record.id,
    metadata: {},
  })
  res.json({ ok: true })
})

app.get("/api/replacement-rules", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (req: AuthedRequest, res) => {
  res.json(replacementRulesForTenant(req))
})

app.post("/api/replacement-rules", authMiddleware, tenantContextMiddleware, requirePermission("replacement_rules.manage.personal"), (req: AuthedRequest, res) => {
  const body = replacementRuleSchema.parse(req.body)
  const record: ReplacementRuleRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    ownerUserId: body.scope === "personal" ? req.auth!.userId : null,
    scope: body.scope,
    ruleType: body.ruleType,
    triggerText: body.triggerText,
    replacementText: body.replacementText,
    priority: body.priority,
    enabled: body.enabled,
    caseSensitive: body.caseSensitive,
    safeRegex: body.safeRegex,
    notes: body.notes,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.replacementRules.push(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "replacement_rule.created", entityType: "replacementRule", entityId: record.id, metadata: record })
  res.status(201).json(record)
})

app.patch("/api/replacement-rules/:id", authMiddleware, tenantContextMiddleware, requirePermission("replacement_rules.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.replacementRules.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Rule not found" })
  Object.assign(record, replacementRuleSchema.partial().parse(req.body), { version: record.version + 1 })
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "replacement_rule.updated", entityType: "replacementRule", entityId: record.id, metadata: {} })
  res.json(record)
})

app.delete("/api/replacement-rules/:id", authMiddleware, tenantContextMiddleware, requirePermission("replacement_rules.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.replacementRules.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Rule not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "replacement_rule.deleted", entityType: "replacementRule", entityId: record.id, metadata: {} })
  res.json({ ok: true })
})

app.get("/api/phrase-templates", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (_req, res) => {
  res.json(state.phraseTemplates.filter((item) => !item.deletedAt))
})

app.post("/api/phrase-templates", authMiddleware, tenantContextMiddleware, requirePermission("phrase_templates.manage.personal"), (req: AuthedRequest, res) => {
  const body = phraseTemplateSchema.parse(req.body)
  const record: PhraseTemplateRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    ownerUserId: body.scope === "personal" ? req.auth!.userId : null,
    scope: body.scope,
    spokenPhrase: body.spokenPhrase,
    outputText: body.outputText,
    variables: body.variables,
    enabled: body.enabled,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.phraseTemplates.push(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "phrase_template.created", entityType: "phraseTemplate", entityId: record.id, metadata: record })
  res.status(201).json(record)
})

app.patch("/api/phrase-templates/:id", authMiddleware, tenantContextMiddleware, requirePermission("phrase_templates.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.phraseTemplates.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Template not found" })
  Object.assign(record, phraseTemplateSchema.partial().parse(req.body))
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "phrase_template.updated", entityType: "phraseTemplate", entityId: record.id, metadata: {} })
  res.json(record)
})

app.delete("/api/phrase-templates/:id", authMiddleware, tenantContextMiddleware, requirePermission("phrase_templates.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.phraseTemplates.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Template not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "phrase_template.deleted", entityType: "phraseTemplate", entityId: record.id, metadata: {} })
  res.json({ ok: true })
})

app.get("/api/voice-functions", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (_req, res) => {
  res.json(state.voiceFunctions.filter((item) => !item.deletedAt))
})

app.post("/api/voice-functions", authMiddleware, tenantContextMiddleware, requirePermission("voice_functions.manage.personal"), (req: AuthedRequest, res) => {
  const body = voiceFunctionSchema.parse(req.body)
  const record: VoiceFunctionRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    ownerUserId: body.scope === "personal" ? req.auth!.userId : null,
    scope: body.scope,
    functionName: body.functionName,
    description: body.description,
    functionType: body.functionType,
    triggerPhrases: body.triggerPhrases,
    instruction: body.instruction,
    outputFormat: body.outputFormat,
    priority: body.priority,
    enabled: body.enabled,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.voiceFunctions.push(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "voice_function.created", entityType: "voiceFunction", entityId: record.id, metadata: record })
  res.status(201).json(record)
})

app.patch("/api/voice-functions/:id", authMiddleware, tenantContextMiddleware, requirePermission("voice_functions.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.voiceFunctions.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Function not found" })
  Object.assign(record, voiceFunctionSchema.partial().parse(req.body))
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "voice_function.updated", entityType: "voiceFunction", entityId: record.id, metadata: {} })
  res.json(record)
})

app.delete("/api/voice-functions/:id", authMiddleware, tenantContextMiddleware, requirePermission("voice_functions.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.voiceFunctions.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Function not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "voice_function.deleted", entityType: "voiceFunction", entityId: record.id, metadata: {} })
  res.json({ ok: true })
})

app.post("/api/voice-functions/test-detection", authMiddleware, tenantContextMiddleware, requirePermission("speech.dictate"), (req: AuthedRequest, res) => {
  const body = testDetectionSchema.parse(req.body)
  const detection = resolveVoiceFunction({
    selectedMode: body.selectedMode,
    transcript: body.transcript,
    userFunctions: state.voiceFunctions.filter((item) => item.ownerUserId === req.auth!.userId && !item.deletedAt),
    tenantFunctions: state.voiceFunctions.filter((item) => item.tenantId === req.tenantId && item.scope === "tenant" && !item.deletedAt),
    systemFunctions: state.voiceFunctions.filter((item) => item.scope === "system" && !item.deletedAt),
  })
  res.json({
    detectedCommand: detection.detectedCommand?.functionName ?? null,
    functionApplied: detection.functionName,
    selectedModeOverridesDetected: detection.selectedModeOverridesDetected,
    resolvedBy: detection.resolvedBy,
  })
})

app.get("/api/email-profiles", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (_req, res) => {
  res.json(state.emailProfiles.filter((item) => !item.deletedAt))
})

app.post("/api/email-profiles", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const body = emailProfileSchema.parse(req.body)
  const record: EmailProfileRecord = {
    id: createId(),
    tenantId: body.scope === "tenant" ? req.tenantId! : null,
    ownerUserId: body.scope === "personal" ? req.auth!.userId : null,
    scope: body.scope,
    profileName: body.profileName,
    fromDisplayName: body.fromDisplayName,
    fromEmail: body.fromEmail,
    defaultGreeting: body.defaultGreeting,
    defaultClosing: body.defaultClosing,
    tonePreference: body.tonePreference,
    enabled: body.enabled,
    signatureId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.emailProfiles.push(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_profile.created", entityType: "emailProfile", entityId: record.id, metadata: record })
  res.status(201).json(record)
})

app.patch("/api/email-profiles/:id", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.emailProfiles.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Profile not found" })
  Object.assign(record, emailProfileSchema.partial().parse(req.body))
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_profile.updated", entityType: "emailProfile", entityId: record.id, metadata: {} })
  res.json(record)
})

app.delete("/api/email-profiles/:id", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.emailProfiles.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Profile not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_profile.deleted", entityType: "emailProfile", entityId: record.id, metadata: {} })
  res.json({ ok: true })
})

app.get("/api/email-signatures", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (_req, res) => {
  res.json(state.emailSignatures.filter((item) => !item.deletedAt).map((item) => ({ ...item, html: item.sanitizedHtml })))
})

app.post("/api/email-signatures", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const body = emailSignatureSchema.parse(req.body)
  const sanitizedHtml = sanitizeHtml(body.html, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]), allowedAttributes: { a: ["href", "name", "target", "rel"], img: ["src", "alt"] } })
  const record: EmailSignatureRecord = {
    id: createId(),
    tenantId: req.tenantId!,
    profileId: body.profileId ?? null,
    html: body.html,
    plainText: body.plainText,
    sanitizedHtml,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  state.emailSignatures.push(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_signature.created", entityType: "emailSignature", entityId: record.id, metadata: {} })
  res.status(201).json(record)
})

app.patch("/api/email-signatures/:id", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.emailSignatures.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Signature not found" })
  const body = emailSignatureSchema.partial().parse(req.body)
  if (body.html) {
    record.html = body.html
    record.sanitizedHtml = sanitizeHtml(body.html, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]) })
  }
  if (body.plainText) record.plainText = body.plainText
  if (body.profileId !== undefined) record.profileId = body.profileId
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_signature.updated", entityType: "emailSignature", entityId: record.id, metadata: {} })
  res.json(record)
})

app.delete("/api/email-signatures/:id", authMiddleware, tenantContextMiddleware, requirePermission("email_profiles.manage.personal"), (req: AuthedRequest, res) => {
  const record = state.emailSignatures.find((item) => item.id === req.params.id && !item.deletedAt)
  if (!record) return res.status(404).json({ error: "Signature not found" })
  record.deletedAt = new Date().toISOString()
  touch(record)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "email_signature.deleted", entityType: "emailSignature", entityId: record.id, metadata: {} })
  res.json({ ok: true })
})

function selectTranscriptionProvider(transcriptionMode: "hybrid" | "local-only") {
  if (config.transcriptionProvider === "local-whisper") {
    if (LocalWhisperProvider.isAvailable()) return new LocalWhisperProvider()
    if (transcriptionMode === "local-only") {
      // Tenant policy requires on-device transcription only — never silently fall back to
      // the mock/cloud-shaped providers, since that would fabricate or mis-route a transcript.
      return null
    }
    return new MockTranscriptionProvider()
  }
  if (config.transcriptionProvider === "openai") return new OpenAIWhisperCompatibleProvider()
  return new MockTranscriptionProvider()
}

app.get("/api/speech/capabilities", authMiddleware, tenantContextMiddleware, (req: AuthedRequest, res) => {
  const tenant = state.tenants.find((item) => item.id === req.tenantId)
  res.json({
    localTranscription: LocalWhisperProvider.isAvailable(),
    transcriptionMode: tenant?.settings.transcriptionMode ?? "hybrid",
  })
})

app.post("/api/speech/dictate", authMiddleware, tenantContextMiddleware, requirePermission("speech.dictate"), async (req: AuthedRequest, res) => {
  const body = dictationSchema.parse(req.body)
  const transcriptionMode = state.tenants.find((item) => item.id === req.tenantId)?.settings.transcriptionMode ?? "hybrid"
  const transcriptionProvider = selectTranscriptionProvider(transcriptionMode)
  if (!transcriptionProvider) {
    return res.status(503).json({
      error: "This organization requires offline transcription, but the local speech model isn't installed on this server. Contact an admin to install it or switch to hybrid mode.",
    })
  }
  const transcription = await transcriptionProvider.transcribe({
    audioBase64: body.audioBase64,
    mimeType: body.mimeType,
    mockTranscript: body.mockTranscript,
  })

  const result = runCorrectionPipeline({
    selectedMode: body.mode,
    transcript: transcription.transcript,
    userId: req.auth!.userId,
    tenantId: req.tenantId!,
    selectedFunction: body.selectedFunction,
  })

  const shouldSave = body.saveHistory && (state.tenants.find((item) => item.id === req.tenantId)?.settings.historyRetentionDays ?? 0) > 0
  if (shouldSave) {
    state.speechHistory.push({
      id: createId(),
      tenantId: req.tenantId!,
      userId: req.auth!.userId,
      mode: body.mode as never,
      detectedCommand: result.detectedCommand,
      functionApplied: result.functionApplied,
      rawTranscript: result.rawTranscript,
      correctedOutput: result.correctedOutput,
      correctionsApplied: result.correctionsApplied,
      confidenceScore: result.confidenceScore,
      status: "modified",
      saved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  addAuditLog({
    tenantId: req.tenantId ?? null,
    actorUserId: req.auth!.userId,
    action: "speech.dictated",
    entityType: "speechSession",
    entityId: null,
    metadata: { mode: body.mode, saved: shouldSave },
  })

  res.json(result)
})

app.post("/api/speech/correct-text", authMiddleware, tenantContextMiddleware, requirePermission("speech.dictate"), (req: AuthedRequest, res) => {
  const body = correctionTextSchema.parse(req.body)
  const result = runCorrectionPipeline({
    selectedMode: body.mode,
    transcript: body.text,
    userId: req.auth!.userId,
    tenantId: req.tenantId!,
    selectedFunction: body.selectedFunction,
  })
  res.json(result)
})

app.get("/api/speech/history", authMiddleware, tenantContextMiddleware, requirePermission("speech.history.read.personal"), (req: AuthedRequest, res) => {
  res.json(state.speechHistory.filter((item) => item.tenantId === req.tenantId && item.userId === req.auth!.userId))
})

app.get("/api/speech/history/:id", authMiddleware, tenantContextMiddleware, requirePermission("speech.history.read.personal"), (req: AuthedRequest, res) => {
  const item = state.speechHistory.find((entry) => entry.id === req.params.id)
  if (!item) return res.status(404).json({ error: "History entry not found" })
  res.json(item)
})

app.patch("/api/speech/history/:id/feedback", authMiddleware, tenantContextMiddleware, requirePermission("speech.history.read.personal"), (req: AuthedRequest, res) => {
  const body = historyFeedbackSchema.parse(req.body)
  const item = state.speechHistory.find((entry) => entry.id === req.params.id)
  if (!item) return res.status(404).json({ error: "History entry not found" })
  item.status = body.status
  touch(item)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "speech.history.feedback", entityType: "speechSession", entityId: item.id, metadata: body })
  res.json(item)
})

app.get("/api/audit", authMiddleware, tenantContextMiddleware, requirePermission("audit.read"), (_req, res) => {
  res.json(state.auditLogs)
})

app.get("/api/devices", authMiddleware, tenantContextMiddleware, requirePermission("roles.manage"), (req: AuthedRequest, res) => {
  res.json(state.devices.filter((device) => device.tenantId === req.tenantId && !device.revokedAt))
})

app.delete("/api/devices/:id", authMiddleware, tenantContextMiddleware, requirePermission("roles.manage"), (req: AuthedRequest, res) => {
  const device = state.devices.find((item) => item.id === req.params.id && item.tenantId === req.tenantId)
  if (!device) return res.status(404).json({ error: "Device not found" })
  device.revokedAt = new Date().toISOString()
  touch(device)
  addAuditLog({ tenantId: req.tenantId ?? null, actorUserId: req.auth!.userId, action: "device.revoked", entityType: "device", entityId: device.id, metadata: {} })
  res.json({ ok: true })
})

app.get("/api/sync/dictionary", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (req: AuthedRequest, res) => {
  const terms = dictionaryTermsForTenant(req)
  const version = terms.reduce((max, term) => Math.max(max, term.version), 1)
  res.json({ tenantId: req.tenantId, version, updatedAt: new Date().toISOString(), terms })
})

app.post("/api/sync/dictionary/pull", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.read"), (req: AuthedRequest, res) => {
  const body = z.object({ deviceId: z.string().optional(), dictionaryVersion: z.number().int().optional() }).parse(req.body)
  res.json({
    tenantId: req.tenantId,
    currentVersion: 1,
    deviceId: body.deviceId ?? null,
    terms: dictionaryTermsForTenant(req),
  })
})

app.post("/api/sync/dictionary/push", authMiddleware, tenantContextMiddleware, requirePermission("dictionary.write.personal"), (req: AuthedRequest, res) => {
  const body = deviceDictionaryPushSchema.parse(req.body)
  const device = body.deviceId ? state.devices.find((item) => item.id === body.deviceId) : state.devices.find((item) => item.tenantId === req.tenantId && item.userId === req.auth!.userId)
  if (device) {
    device.dictionaryVersion = body.dictionaryVersion ?? device.dictionaryVersion + 1
    device.lastSeenAt = new Date().toISOString()
    touch(device)
  }
  res.json({ ok: true, synced: body.terms.length, deviceId: device?.id ?? null })
})

app.use(errorHandler)

function runCorrectionPipeline(input: { selectedMode: string; transcript: string; userId: string; tenantId: string; selectedFunction?: string }) {
  const userTerms = state.dictionaryTerms.filter((item) => item.ownerUserId === input.userId && item.scope === "personal" && !item.deletedAt)
  const tenantTerms = state.dictionaryTerms.filter((item) => item.tenantId === input.tenantId && item.scope === "tenant" && !item.deletedAt)
  const systemTerms = state.dictionaryTerms.filter((item) => item.scope === "system" && !item.deletedAt)
  const resolvedTerms = [...userTerms, ...tenantTerms, ...systemTerms]
  const replacementRules = state.replacementRules.filter((item) => (item.ownerUserId === input.userId || item.tenantId === input.tenantId || item.scope === "system") && !item.deletedAt)
  const templates = state.phraseTemplates.filter((item) => (item.ownerUserId === input.userId || item.tenantId === input.tenantId || item.scope === "system") && !item.deletedAt)
  const voiceFunctions = state.voiceFunctions.filter((item) => (item.ownerUserId === input.userId || item.tenantId === input.tenantId || item.scope === "system") && !item.deletedAt)
  const emailProfile = state.emailProfiles.find((item) => item.tenantId === input.tenantId && item.enabled && !item.deletedAt) ?? null
  const signature = emailProfile?.signatureId ? state.emailSignatures.find((item) => item.id === emailProfile.signatureId && !item.deletedAt) ?? null : null

  const termsApplied = resolvedTerms
    .map((term) => ({ term, found: transcriptContains(input.transcript, term) }))
    .filter((item) => item.found)

  const afterTemplates = applyTemplates(input.transcript, templates)
  const afterRules = applyReplacementRules(afterTemplates.text, replacementRules)
  const selectedFunctionResolution = resolveVoiceFunction({
    selectedMode: input.selectedMode,
    transcript: afterRules.text,
    userFunctions: voiceFunctions.filter((item) => item.ownerUserId === input.userId),
    tenantFunctions: voiceFunctions.filter((item) => item.tenantId === input.tenantId),
    systemFunctions: voiceFunctions.filter((item) => item.scope === "system"),
  })

  const correctedOutput = formatTranscript({
    transcript: afterRules.text,
    functionName: input.selectedFunction || selectedFunctionResolution.functionName,
    mode: input.selectedMode,
    emailProfile,
    signature,
    phraseTemplates: templates,
  })

  return {
    rawTranscript: input.transcript,
    correctedOutput,
    confidenceScore: Math.min(0.99, 0.72 + termsApplied.length * 0.05 + afterRules.applied.length * 0.03),
    detectedCommand: selectedFunctionResolution.detectedCommand?.functionName ?? null,
    functionApplied: input.selectedFunction || selectedFunctionResolution.functionName,
    appliedCorrections: [
      ...termsApplied.map((item) => ({ kind: "dictionary", before: item.term.spokenForm, after: item.term.correctText, source: item.term.scope })),
      ...afterRules.applied,
      ...(afterTemplates.applied ? [{ kind: "phrase_template", before: afterTemplates.applied.spokenPhrase, after: afterTemplates.applied.outputText, source: afterTemplates.applied.scope }] : []),
    ],
    correctionsApplied: [
      ...termsApplied.map((item) => ({ kind: "dictionary", before: item.term.spokenForm, after: item.term.correctText, source: item.term.scope })),
      ...afterRules.applied,
      ...(afterTemplates.applied ? [{ kind: "phrase_template", before: afterTemplates.applied.spokenPhrase, after: afterTemplates.applied.outputText, source: afterTemplates.applied.scope }] : []),
    ],
  }
}

function transcriptContains(transcript: string, term: DictionaryTermRecord) {
  if (term.caseSensitive) {
    return transcript.includes(term.spokenForm)
  }
  return transcript.toLowerCase().includes(term.spokenForm.toLowerCase())
}

function dictionaryTermsForTenant(req: AuthedRequest) {
  return state.dictionaryTerms.filter((item) => !item.deletedAt && (item.scope === "system" || item.tenantId === req.tenantId || item.ownerUserId === req.auth!.userId))
}

function replacementRulesForTenant(req: AuthedRequest) {
  return state.replacementRules.filter((item) => !item.deletedAt && (item.scope === "system" || item.tenantId === req.tenantId || item.ownerUserId === req.auth!.userId))
}

function membershipsForUser(userId: string) {
  return state.memberships
    .filter((item) => item.userId === userId && item.active)
    .map((membership) => ({
      id: membership.id,
      tenantId: membership.tenantId,
      role: membership.role,
      tenant: publicTenant(state.tenants.find((tenant) => tenant.id === membership.tenantId)!),
    }))
}

function publicUser(user: { id: string; displayName: string; email: string; emailVerified: boolean; activeTenantId: string | null }) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    activeTenantId: user.activeTenantId,
  }
}

function publicTenant(tenant: { id: string; name: string; slug: string; settings: unknown }) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    settings: tenant.settings,
  }
}

export { app }
