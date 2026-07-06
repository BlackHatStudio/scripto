export const permissions = [
  "tenant.manage",
  "users.manage",
  "roles.manage",
  "dictionary.read",
  "dictionary.write.personal",
  "dictionary.write.shared",
  "replacement_rules.manage.personal",
  "replacement_rules.manage.shared",
  "phrase_templates.manage.personal",
  "phrase_templates.manage.shared",
  "voice_functions.manage.personal",
  "voice_functions.manage.shared",
  "email_profiles.manage.personal",
  "email_profiles.manage.shared",
  "speech.dictate",
  "speech.history.read.personal",
  "speech.history.read.tenant",
  "audit.read",
  "settings.manage",
] as const

export type Permission = (typeof permissions)[number]

export const roles = [
  "PlatformOwner",
  "TenantOwner",
  "TenantAdmin",
  "Manager",
  "User",
  "ReadOnlyAuditor",
] as const

export type RoleName = (typeof roles)[number]

export const rolePermissionMap: Record<RoleName, Permission[]> = {
  PlatformOwner: [...permissions],
  TenantOwner: [
    "tenant.manage",
    "users.manage",
    "roles.manage",
    "dictionary.read",
    "dictionary.write.personal",
    "dictionary.write.shared",
    "replacement_rules.manage.personal",
    "replacement_rules.manage.shared",
    "phrase_templates.manage.personal",
    "phrase_templates.manage.shared",
    "voice_functions.manage.personal",
    "voice_functions.manage.shared",
    "email_profiles.manage.personal",
    "email_profiles.manage.shared",
    "speech.dictate",
    "speech.history.read.personal",
    "speech.history.read.tenant",
    "audit.read",
    "settings.manage",
  ],
  TenantAdmin: [
    "tenant.manage",
    "users.manage",
    "roles.manage",
    "dictionary.read",
    "dictionary.write.shared",
    "replacement_rules.manage.shared",
    "phrase_templates.manage.shared",
    "voice_functions.manage.shared",
    "email_profiles.manage.shared",
    "speech.dictate",
    "speech.history.read.tenant",
    "audit.read",
    "settings.manage",
  ],
  Manager: [
    "dictionary.read",
    "dictionary.write.personal",
    "replacement_rules.manage.personal",
    "phrase_templates.manage.personal",
    "voice_functions.manage.personal",
    "email_profiles.manage.personal",
    "speech.dictate",
    "speech.history.read.personal",
  ],
  User: [
    "dictionary.read",
    "dictionary.write.personal",
    "replacement_rules.manage.personal",
    "phrase_templates.manage.personal",
    "voice_functions.manage.personal",
    "email_profiles.manage.personal",
    "speech.dictate",
    "speech.history.read.personal",
  ],
  ReadOnlyAuditor: ["dictionary.read", "speech.history.read.tenant", "audit.read"],
}

export const dictionaryScopes = ["system", "tenant", "personal"] as const
export type DictionaryScope = (typeof dictionaryScopes)[number]

export const ruleTypes = ["exact", "phrase", "fuzzy", "phonetic", "regex"] as const
export type RuleType = (typeof ruleTypes)[number]

export const functionTypes = [
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
] as const

export type FunctionType = (typeof functionTypes)[number]

export const modes = [
  "Plain",
  "Email",
  "List",
  "Text Message",
  "Codex / Cursor Prompt",
  "Meeting Notes",
  "Custom Function",
] as const

export type ModeName = (typeof modes)[number]
