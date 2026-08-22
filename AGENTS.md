# Scripto App Desktop - Agent Guidance

## 1. Mission

The desktop app is the local working application for Scripto App. It must:
- Run on Windows desktop hardware.
- Capture dictation.
- Apply speech correction using dictionaries.
- Prefer local memory, cache, and storage first.
- Sync all durable data to PostgreSQL.
- Operate from the Windows system tray.
- Support optional launch at Windows startup.
- Be packaged and upgraded through a ZIP deployment bundle containing an EXE installer/updater.

## 2. Application Boundaries

The desktop app is separate from:
- Web admin portal
- iOS app
- Cloud database layer

The desktop app may communicate with shared backend services and PostgreSQL, but it must remain independently installable and upgradeable.

## 3. Expected Technology Direction

Use this as the preferred structure unless existing project files show a different approved stack:
- Node.js
- Next.js for local UI and admin screens
- Electron or an equivalent desktop wrapper for system tray, startup registration, and local desktop behavior
- TypeScript
- PostgreSQL for cloud persistence
- Local storage layer for offline-first dictionary and dictation behavior
- Environment variables for all secrets and deployment-specific settings

Do not hardcode connection strings, credentials, user IDs, tenant IDs, file paths, or environment-specific values.

## 4. Local-First Dictionary Design

The dictionary correction system must use this order of precedence:

1. In-memory dictionary cache
2. Local persistent dictionary store
3. Cloud PostgreSQL dictionary records

The desktop app must not depend on a live cloud connection to perform common corrections.

Dictionary types should be treated as layered sources:
- System dictionary
- Tenant/shared dictionary
- User dictionary
- Local temporary/session dictionary

Correction priority:
1. User-specific dictionary
2. Tenant/shared dictionary
3. System dictionary
4. Local temporary/session correction rules

Each dictionary entry should support:
- incorrect phrase or token
- corrected phrase or token
- match type
- case sensitivity setting
- whole-word matching setting
- priority
- enabled or disabled state
- source or scope
- created and updated timestamps
- created and updated by
- sync status
- version or revision tracking

The correction engine must be deterministic, testable, and auditable.

## 5. Local Storage and Local Memory

The desktop app must maintain:
- fast in-memory cache for active correction rules
- local persistent storage for dictionary entries
- local persistent storage for dictation sessions
- local queue for pending sync operations
- local app settings
- local audit or event logs

Preferred local storage options:
- SQLite for structured local persistence
- encrypted local config or secret storage where credentials or tokens are stored
- avoid browser-only localStorage for durable desktop records unless used only for non-sensitive UI preferences

Local data must survive app restart and system reboot.

## 6. PostgreSQL Sync Requirements

PostgreSQL is the cloud source of durable truth.

All durable local records must eventually sync to PostgreSQL, including:
- dictation sessions
- transcription text
- corrected text
- dictionary entries
- user settings that are meant to roam
- sync events
- audit events
- installer or update status if applicable

Sync behavior:
- Pull cloud dictionary changes on app startup.
- Pull cloud dictionary changes on a scheduled interval.
- Push local dictionary changes to PostgreSQL.
- Push dictation and session records to PostgreSQL.
- Queue changes when offline.
- Retry failed sync operations safely.
- Do not duplicate records.
- Use stable IDs, revision numbers, and updated_at timestamps.
- Prefer explicit conflict handling over silent overwrite.

Every sync operation must be logged with:
- operation type
- local record ID
- cloud record ID if available
- status
- error message if failed
- timestamp
- retry count

## 7. System Tray Behavior

The desktop app must run in the Windows system tray.

System tray menu should include:
- Open Scripto
- Start Dictation
- Stop Dictation
- Sync Now
- Dictionary
- Settings
- Launch at Startup toggle
- Check for Updates
- Quit

Closing the main window should minimize to tray unless the user explicitly quits.

The app must clearly distinguish:
- window closed or minimized
- app still running in tray
- app fully exited

## 8. Auto-Start at Windows Startup

The desktop app must include a user setting:
- Launch app at login or startup

Implementation requirements:
- Disabled by default unless specified otherwise.
- User can toggle it from Settings.
- Must use a proper Windows startup registration method.
- Do not hardcode user-specific startup paths.
- Store the preference locally and sync to cloud only if user settings are designed to roam.
- Log when startup registration is enabled or disabled.

## 9. Installer and Upgrade Package Strategy

All deployments must be delivered as a ZIP file.

Each deployment ZIP must contain:
- EXE installer or updater
- application build artifacts
- version manifest
- migration scripts if required
- rollback metadata
- checksum or integrity manifest
- release notes
- install or upgrade logs folder or log path definition

The EXE installer or updater must:
- prompt for install root if needed
- detect existing installation
- stop the running desktop app safely
- preserve environment files
- preserve local database and storage
- preserve user settings
- preserve logs unless retention policy says otherwise
- back up key files before replacement
- apply database migrations safely
- update application files
- restart the app if it was running before upgrade
- write detailed install or upgrade logs
- support rollback when upgrade fails

Never overwrite:
- `.env`
- `.env.local`
- local database files
- local dictionary files
- local pending sync queue
- user settings
- certificates, keys, or tokens
- install-specific config

Installer must be repeatable and safe to rerun.

## 10. Versioning

Use explicit versioning for:
- desktop app version
- installer version
- local database schema version
- cloud schema compatibility version
- dictionary schema version
- sync protocol version

Include a local version state file or local metadata table.

The app should be able to report:
- installed version
- last successful upgrade
- last failed upgrade
- current local schema version
- current cloud sync compatibility version

## 11. Security Requirements

Do not store sensitive secrets in plain text.

Use:
- environment variables for deployment-specific config
- encrypted secure storage for local tokens or secrets
- least-privilege PostgreSQL roles
- TLS for cloud database connections
- audit logging for sync, correction changes, dictionary edits, and admin actions

Do not allow external authentication to access internal credentials.

Do not commit:
- `.env` files
- credentials
- production config
- certificates
- tokens
- local database files
- logs containing sensitive data

## 12. Auditability

The app must maintain auditable records for:
- dictation session created
- correction applied
- dictionary entry created
- dictionary entry updated
- dictionary entry deleted or disabled
- sync started, completed, or failed
- installer started, completed, or failed
- app startup or shutdown
- launch-at-startup enabled or disabled

Audit records should include:
- event type
- timestamp UTC
- actor, user, or device
- before and after values where appropriate
- source module
- correlation ID where useful

## 13. Suggested Project Structure

If the existing structure allows it, organize desktop app files like this:

```text
apps/
  desktop/
    src/
      main/
        tray/
        startup/
        updater/
        window/
      renderer/
        app/
        components/
        features/
        settings/
        dictionary/
        dictation/
      shared/
        types/
        constants/
        validation/
      local/
        db/
        repositories/
        queue/
        cache/
      sync/
        postgres/
        jobs/
        conflict-resolution/
      correction/
        engine/
        rules/
        tests/
      installer/
        scripts/
        manifests/
        rollback/
    tests/
    AGENTS.md if app-specific guidance is needed
```

If the repo already has a different structure, adapt to the existing structure without unnecessary churn.

## 14. Coding Standards

All new code must be:
- TypeScript-first
- modular
- testable
- environment-configured
- production-safe
- reversible
- documented where behavior is not obvious

Do not build hidden coupling between:
- desktop app and web portal
- local dictionary engine and cloud sync
- installer and application runtime
- UI and persistence logic

Use service boundaries:
- correction service
- local storage service
- sync service
- tray service
- startup service
- installer or update service
- settings service
- audit service

## 15. Database and Data Integrity Rules

Local and cloud records must include:
- stable primary keys
- created_at
- updated_at
- created_by where applicable
- updated_by where applicable
- deleted_at or disabled flag where soft-delete is appropriate
- revision or version field for conflict handling
- source or scope field where applicable

No orphaned data.
No silent deletes.
No destructive migrations without backup and rollback.

## 16. Sync Conflict Rules

When local and cloud records conflict:
- Do not silently overwrite without a rule.
- Prefer deterministic conflict resolution.
- Track conflict state if human review is needed.
- Log all conflicts.
- Preserve both values when the conflict cannot be safely resolved.

Recommended default:
- Dictionary conflicts should prefer the newest revision only when scope and ownership match.
- User dictionary entries should not be overwritten by tenant or system dictionaries.
- System dictionary updates should not delete user overrides.

## 17. Testing Requirements

Include tests for:
- correction rule application
- correction priority ordering
- local dictionary load and save
- sync queue behavior
- conflict handling
- startup setting toggle
- system tray command handlers
- installer backup behavior
- installer rollback behavior
- environment preservation

Before changing installer or update behavior, add or update tests.

## 18. Deployment Safety

Before generating install or upgrade scripts:
- identify files that must be preserved
- identify files that can be replaced
- identify services or processes to stop
- identify rollback location
- identify log path
- identify required privileges

Installer or updater must never assume admin rights unless explicitly required and documented.

## 19. Human Review Points

Require human review before:
- changing database schema
- changing installer overwrite behavior
- changing startup registration behavior
- changing dictionary precedence rules
- changing sync conflict rules
- changing credential storage behavior
- deleting local data
- modifying production connection settings

## 20. Codex Operating Rules

When making changes:
- Inspect existing files first.
- Prefer small, reviewable changes.
- Do not work directly against production settings.
- Do not introduce hardcoded paths except documented defaults.
- Do not remove existing config preservation logic.
- Do not replace working project structure unless necessary.
- Explain what changed and why.
- Provide validation steps after changes.
- Provide rollback steps for installer and deployment changes.

## 21. Initial Desktop Build Priorities

Prioritize in this order:

1. AGENTS.md guidance
2. Local dictionary model
3. Local storage model
4. Correction engine boundary
5. PostgreSQL sync boundary
6. System tray shell
7. Launch-at-startup setting
8. Installer and update package design
9. Tests
10. UI polish

Do not jump into advanced UI until the local-first correction, storage, sync, and installer boundaries are defined.

After creating or updating AGENTS.md, summarize:
- file path created or updated
- key sections added
- any assumptions made
- recommended next implementation task
