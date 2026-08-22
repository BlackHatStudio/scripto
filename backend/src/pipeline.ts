import { modes } from "./constants"
import type {
  DictionaryTermRecord,
  EmailProfileRecord,
  EmailSignatureRecord,
  PhraseTemplateRecord,
  ReplacementRuleRecord,
  VoiceFunctionRecord,
} from "./types"

export interface TranscriptionProvider {
  transcribe(input: {
    audioBase64?: string
    mimeType?: string
    mockTranscript?: string
    locale?: string
  }): Promise<{ transcript: string; confidenceScore: number; provider: string }>
}

export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: { mockTranscript?: string; audioBase64?: string; mimeType?: string; locale?: string }) {
    return {
      transcript: input.mockTranscript?.trim() || "Mock transcript captured from the browser audio input.",
      confidenceScore: input.mockTranscript ? 0.97 : 0.82,
      provider: "mock",
    }
  }
}

export class OpenAIWhisperCompatibleProvider implements TranscriptionProvider {
  async transcribe(input: { mockTranscript?: string; audioBase64?: string; mimeType?: string; locale?: string }) {
    return {
      transcript: input.mockTranscript?.trim() || "Whisper-compatible transcription placeholder.",
      confidenceScore: 0.9,
      provider: "openai-whisper-compatible",
    }
  }
}

export function resolveDictionaryTerms(input: {
  userTerms: DictionaryTermRecord[]
  tenantTerms: DictionaryTermRecord[]
  systemTerms: DictionaryTermRecord[]
}) {
  return [...input.userTerms, ...input.tenantTerms, ...input.systemTerms]
    .filter((term) => term.enabled && !term.deletedAt)
    .sort((left, right) => {
      const scopeOrder = { personal: 0, tenant: 1, system: 2 } as const
      return scopeOrder[left.scope] - scopeOrder[right.scope] || right.version - left.version
    })
}

export function applyReplacementRules(
  text: string,
  rules: ReplacementRuleRecord[]
): { text: string; applied: Array<{ kind: string; before: string; after: string; source: string }> } {
  let output = text
  const applied: Array<{ kind: string; before: string; after: string; source: string }> = []

  const orderedRules = [...rules]
    .filter((rule) => rule.enabled && !rule.deletedAt)
    .sort((left, right) => right.priority - left.priority)

  for (const rule of orderedRules) {
    const before = output
    if (rule.ruleType === "exact") {
      const next = rule.caseSensitive
        ? output.split(rule.triggerText).join(rule.replacementText)
        : output.replace(new RegExp(escapeRegex(rule.triggerText), "gi"), rule.replacementText)
      if (next !== output) {
        output = next
        applied.push({ kind: "exact", before: rule.triggerText, after: rule.replacementText, source: rule.scope })
      }
      continue
    }

    if (rule.ruleType === "phrase") {
      const next = output.replace(new RegExp(`\\b${escapeRegex(rule.triggerText)}\\b`, "gi"), rule.replacementText)
      if (next !== output) {
        output = next
        applied.push({ kind: "phrase", before: rule.triggerText, after: rule.replacementText, source: rule.scope })
      }
      continue
    }

    if (rule.ruleType === "regex" && rule.safeRegex) {
      try {
        const next = output.replace(new RegExp(rule.triggerText, "gi"), rule.replacementText)
        if (next !== output) {
          output = next
          applied.push({ kind: "regex", before: rule.triggerText, after: rule.replacementText, source: rule.scope })
        }
      } catch {
        // ignore unsafe regex errors
      }
      continue
    }

    if ((rule.ruleType === "fuzzy" || rule.ruleType === "phonetic") && before !== output) {
      applied.push({ kind: rule.ruleType, before: rule.triggerText, after: rule.replacementText, source: rule.scope })
    }
  }

  return { text: output, applied }
}

export function resolveVoiceFunction(input: {
  selectedMode?: string
  transcript: string
  userFunctions: VoiceFunctionRecord[]
  tenantFunctions: VoiceFunctionRecord[]
  systemFunctions: VoiceFunctionRecord[]
}) {
  const transcript = input.transcript.toLowerCase()

  if (input.selectedMode && (modes as readonly string[]).includes(input.selectedMode)) {
    return {
      functionName: input.selectedMode,
      resolvedBy: "selected mode",
      selectedModeOverridesDetected: true,
      detectedCommand: detectCommand(transcript, [...input.userFunctions, ...input.tenantFunctions, ...input.systemFunctions]),
    }
  }

  const detectedCommand = detectCommand(transcript, [...input.userFunctions, ...input.tenantFunctions, ...input.systemFunctions])
  if (detectedCommand) {
    return { functionName: detectedCommand.functionName, resolvedBy: "spoken command", selectedModeOverridesDetected: false, detectedCommand }
  }

  const byPriority = [...input.userFunctions, ...input.tenantFunctions, ...input.systemFunctions]
    .filter((fn) => fn.enabled && !fn.deletedAt)
    .sort((left, right) => right.priority - left.priority)
  const selected = byPriority[0] ?? null
  return {
    functionName: selected?.functionName ?? "Plain dictation",
    resolvedBy: selected ? "priority fallback" : "plain fallback",
    selectedModeOverridesDetected: false,
    detectedCommand: null,
  }
}

function detectCommand(transcript: string, functions: VoiceFunctionRecord[]) {
  const ordered = [...functions]
    .filter((fn) => fn.enabled && !fn.deletedAt)
    .sort((left, right) => right.priority - left.priority)

  for (const fn of ordered) {
    for (const trigger of fn.triggerPhrases) {
      if (trigger && transcript.includes(trigger.toLowerCase())) {
        return fn
      }
    }
  }

  return null
}

export function formatTranscript(input: {
  transcript: string
  functionName: string
  mode?: string
  emailProfile?: EmailProfileRecord | null
  signature?: EmailSignatureRecord | null
  phraseTemplates?: PhraseTemplateRecord[]
}) {
  const mode = input.mode ?? "Plain"
  let output = input.transcript

  if (mode === "Email" && input.emailProfile) {
    const greeting = input.emailProfile.defaultGreeting || "Hi"
    const closing = input.emailProfile.defaultClosing || "Best"
    const signature = input.signature?.plainText ? `\n\n${input.signature.plainText}` : ""
    output = `${greeting},\n\n${capitalizeFirstSentence(output)}\n\n${closing},\n${input.emailProfile.fromDisplayName}${signature}`
  } else if (mode === "List") {
    output = output
      .split(/,| and /i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `- ${capitalizeFirstLetter(part)}`)
      .join("\n")
  } else if (mode === "Text Message") {
    output = capitalizeFirstSentence(output).replace(/\bmessage\b/gi, "text")
  } else if (mode === "Codex / Cursor Prompt") {
    output = `Implementation request:\n${output}\n\nConstraints:\n- Preserve current behavior\n- Add tests where relevant`
  } else if (mode === "Meeting Notes") {
    output = `Meeting Notes\n\nSummary:\n${capitalizeFirstSentence(output)}`
  } else if (mode === "Custom Function") {
    output = `Custom function output for ${input.functionName}:\n${output}`
  }

  return output
}

export function applyTemplates(text: string, templates: PhraseTemplateRecord[]) {
  const found = templates.find(
    (template) => template.enabled && !template.deletedAt && text.toLowerCase().includes(template.spokenPhrase.toLowerCase())
  )

  if (!found) {
    return { text, applied: null as null | PhraseTemplateRecord }
  }

  return {
    text: text.replace(new RegExp(escapeRegex(found.spokenPhrase), "gi"), found.outputText),
    applied: found,
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function capitalizeFirstLetter(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function capitalizeFirstSentence(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return capitalizeFirstLetter(trimmed)
}
