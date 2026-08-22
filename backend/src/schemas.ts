import { roles } from "./constants"
import { z } from "zod"

export const signupSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(2),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const switchTenantSchema = z.object({
  tenantId: z.string().min(1),
})

export const updateRolesSchema = z.object({
  role: z.enum(roles as unknown as [typeof roles[number], ...typeof roles[number][]]),
})

export const dictionaryCategorySchema = z.object({
  name: z.string().min(1),
  scope: z.enum(["system", "tenant", "user"]),
})

export const dictionaryTermSchema = z.object({
  correctText: z.string().min(1),
  spokenForm: z.string().optional(),
  phoneticHint: z.string().optional().default(""),
  categoryId: z.string().nullable().optional(),
  scope: z.enum(["system", "tenant", "personal"]).default("personal"),
  caseSensitive: z.boolean().default(false),
  enabled: z.boolean().default(true),
  notes: z.string().optional().default(""),
})

export const replacementRuleSchema = z.object({
  triggerText: z.string().min(1),
  replacementText: z.string().min(1),
  scope: z.enum(["system", "tenant", "personal"]).default("personal"),
  ruleType: z.enum(["exact", "phrase", "fuzzy", "phonetic", "regex"]).default("exact"),
  priority: z.number().int().default(50),
  enabled: z.boolean().default(true),
  caseSensitive: z.boolean().default(false),
  safeRegex: z.boolean().default(false),
  notes: z.string().optional().default(""),
})

export const phraseTemplateSchema = z.object({
  spokenPhrase: z.string().min(1),
  outputText: z.string().min(1),
  variables: z.array(z.string()).default([]),
  scope: z.enum(["system", "tenant", "personal"]).default("personal"),
  enabled: z.boolean().default(true),
})

export const voiceFunctionSchema = z.object({
  functionName: z.string().min(1),
  description: z.string().default(""),
  functionType: z.enum([
    "plain",
    "email",
    "list",
    "numbered_list",
    "text_message",
    "codex_prompt",
    "cursor_prompt",
    "meeting_notes",
    "action_items",
    "custom",
  ]),
  triggerPhrases: z.array(z.string()).default([]),
  instruction: z.string().default(""),
  outputFormat: z.string().default(""),
  priority: z.number().int().default(50),
  enabled: z.boolean().default(true),
  scope: z.enum(["system", "tenant", "personal"]).default("personal"),
})

export const emailProfileSchema = z.object({
  profileName: z.string().min(1),
  fromDisplayName: z.string().min(1),
  fromEmail: z.string().email(),
  defaultGreeting: z.string().default("Hi"),
  defaultClosing: z.string().default("Best"),
  tonePreference: z.string().default("professional"),
  enabled: z.boolean().default(true),
  scope: z.enum(["system", "tenant", "personal"]).default("personal"),
})

export const emailSignatureSchema = z.object({
  html: z.string().min(1),
  plainText: z.string().min(1),
  profileId: z.string().nullable().optional(),
})

export const dictationSchema = z.object({
  mode: z.string().default("Plain"),
  mockTranscript: z.string().optional(),
  selectedFunction: z.string().optional(),
  saveHistory: z.boolean().optional().default(true),
  audioBase64: z.string().optional(),
  mimeType: z.string().optional(),
})

export const correctionTextSchema = z.object({
  text: z.string().min(1),
  mode: z.string().default("Plain"),
  selectedFunction: z.string().optional(),
})

export const testDetectionSchema = z.object({
  transcript: z.string().min(1),
  selectedMode: z.string().optional(),
})

export const historyFeedbackSchema = z.object({
  status: z.enum(["accepted", "modified", "discarded"]),
})

export const deviceDictionaryPushSchema = z.object({
  deviceId: z.string().optional(),
  dictionaryVersion: z.number().int().optional(),
  terms: z.array(z.any()).default([]),
})
